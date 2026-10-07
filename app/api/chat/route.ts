import { conversar } from '@/lib/claude'
import { usuarioAtual } from '@/lib/auth'
import { verificarLimite, validarMensagens, ipDaRequisicao } from '@/lib/ratelimit'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: Request) {
  const encoder = new TextEncoder()

  const erroSSE = (mensagem: string, status = 200) =>
    new Response(
      encoder.encode(`data: ${JSON.stringify({ tipo: 'erro', mensagem })}\n\ndata: ${JSON.stringify({ tipo: 'fim' })}\n\n`),
      { status, headers: { 'Content-Type': 'text/event-stream' } }
    )

  const limite = verificarLimite(ipDaRequisicao(req))
  if (!limite.ok) return erroSSE(limite.motivo)

  let body: any
  try {
    body = await req.json()
  } catch {
    return erroSSE('Não entendi o pedido.')
  }

  const v = validarMensagens(body?.mensagens)
  if (!v.ok) return erroSSE(v.motivo)

  // Identidade anônima de navegador, gerada no cliente. Não é login e não
  // identifica pessoa: serve para agrupar as buscas e as seleções de uma mesma
  // sessão, que é o mínimo para o corretor reencontrar o que mandou ao cliente.
  // Formato restrito para esse valor não virar vetor de injeção no histórico.
  const corretorId =
    typeof body?.corretorId === 'string' && /^[a-z0-9-]{8,64}$/i.test(body.corretorId)
      ? body.corretorId
      : null

  // O briefing é a primeira fala do corretor: é o que explica, no histórico de
  // buscas, por que aquele conjunto de critérios foi pedido.
  const primeira = v.mensagens.find((m) => m.role === 'user')
  const briefing =
    typeof primeira?.content === 'string' ? primeira.content.slice(0, 4000) : null

  // Quem está logado. A busca é atribuída à pessoa, e é isso que faz ela
  // aparecer no painel dela e no da equipe.
  const u = await usuarioAtual()
  const contexto = { corretorId, usuarioId: u?.id ?? null, briefing }

  const stream = new ReadableStream({
    async start(controller) {
      // Quando o cliente aborta (botão parar), o controller já fechou e o
      // enqueue lança. Não é erro de verdade: é a pessoa desistindo.
      let fechado = false
      const enviar = (evento: unknown) => {
        if (fechado) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(evento)}\n\n`))
        } catch {
          fechado = true
        }
      }

      try {
        for await (const evento of conversar(v.mensagens, contexto)) enviar(evento)
      } catch (erro) {
        console.error('Erro no chat:', erro)
        enviar({
          tipo: 'erro',
          mensagem: 'Não consegui consultar os imóveis agora. Tenta de novo em alguns segundos.',
        })
      } finally {
        if (!fechado) {
          try {
            controller.close()
          } catch {
            // já fechado pelo abort do cliente
          }
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
