/**
 * Um endpoint público que dispara claude-opus-5 com até 8 iterações de tool
 * use é um cartão de crédito exposto. Sem isto, um loop de curl esvazia a
 * conta na primeira semana.
 *
 * Token bucket em memória: serve uma instância, que é o que temos. Se um dia
 * houver mais de uma, isto vira tabela no Postgres — a interface não muda.
 */

type Balde = { tokens: number; ultimoRefill: number }

const baldes = new Map<string, Balde>()

// Janela curta: rajada de perguntas numa conversa é normal.
const CAPACIDADE = 12
const REFILL_MS = 60_000 // 1 token por minuto
const MAX_BALDES = 10_000

/** Contador global do dia, como freio de emergência de custo. */
let gastoHoje = 0
let diaCorrente = new Date().toDateString()
const TETO_DIARIO = Number(process.env.CHAT_DAILY_LIMIT ?? 2_000)

export type Veredito = { ok: true } | { ok: false; motivo: string; esperar?: number }

export function verificarLimite(ip: string): Veredito {
  const agora = Date.now()

  const hoje = new Date().toDateString()
  if (hoje !== diaCorrente) {
    diaCorrente = hoje
    gastoHoje = 0
  }

  if (gastoHoje >= TETO_DIARIO) {
    return {
      ok: false,
      motivo: 'O limite de conversas de hoje acabou. Volta amanhã que eu te ajudo.',
    }
  }

  // Evita o Map crescer sem fim com IPs de passagem.
  if (baldes.size > MAX_BALDES) {
    for (const [k, b] of baldes) {
      if (agora - b.ultimoRefill > 30 * 60_000) baldes.delete(k)
    }
  }

  const b = baldes.get(ip) ?? { tokens: CAPACIDADE, ultimoRefill: agora }
  const ganhos = Math.floor((agora - b.ultimoRefill) / REFILL_MS)
  if (ganhos > 0) {
    b.tokens = Math.min(CAPACIDADE, b.tokens + ganhos)
    b.ultimoRefill = agora
  }

  if (b.tokens < 1) {
    baldes.set(ip, b)
    const esperar = Math.ceil((REFILL_MS - (agora - b.ultimoRefill)) / 1000)
    return {
      ok: false,
      motivo: `Calma aí — muitas perguntas seguidas. Tenta de novo em ${esperar}s.`,
      esperar,
    }
  }

  b.tokens -= 1
  baldes.set(ip, b)
  gastoHoje += 1
  return { ok: true }
}

const MAX_TURNOS = 30
const MAX_CHARS = 2_000

/**
 * O histórico vem do cliente, então vem de um estranho. Um array de 500
 * mensagens de 50 mil caracteres é um pedido perfeitamente válido em JSON e
 * perfeitamente ruinoso na fatura.
 */
export function validarMensagens(m: unknown): { ok: true; mensagens: any[] } | { ok: false; motivo: string } {
  if (!Array.isArray(m)) return { ok: false, motivo: 'Formato inválido.' }
  if (m.length === 0) return { ok: false, motivo: 'Manda alguma coisa primeiro.' }
  if (m.length > MAX_TURNOS) {
    return {
      ok: false,
      motivo: 'Essa conversa ficou longa demais. Começa uma nova que eu mantenho o foco.',
    }
  }

  for (const msg of m) {
    if (!msg || typeof msg !== 'object') return { ok: false, motivo: 'Formato inválido.' }
    if (msg.role !== 'user' && msg.role !== 'assistant') {
      return { ok: false, motivo: 'Formato inválido.' }
    }
    if (typeof msg.content === 'string' && msg.content.length > MAX_CHARS) {
      return { ok: false, motivo: 'Mensagem longa demais. Resume em até 2 mil caracteres?' }
    }
  }

  if (m[0].role !== 'user') return { ok: false, motivo: 'Formato inválido.' }
  return { ok: true, mensagens: m }
}

export function ipDaRequisicao(req: Request): string {
  const h = req.headers
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'desconhecido'
  )
}
