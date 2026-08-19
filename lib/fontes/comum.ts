export type Node = Record<string, any>

/**
 * JSON-LD permite que qualquer propriedade seja um objeto ou um array de
 * objetos. A Auxiliadora usa array em `offers` e objeto em `itemOffered`,
 * então nunca assuma a forma — desembrulhe sempre.
 */
export function primeiro(v: unknown): Node {
  if (Array.isArray(v)) return (v[0] ?? {}) as Node
  return (v ?? {}) as Node
}

export function comoLista(v: unknown): Node[] {
  if (Array.isArray(v)) return v as Node[]
  return v ? [v as Node] : []
}

export function extrairJsonLd(html: string): Node[] {
  const blocos = [
    ...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g),
  ]
  const nodes: Node[] = []
  for (const [, raw] of blocos) {
    try {
      const d = JSON.parse(raw.trim())
      if (Array.isArray(d['@graph'])) nodes.push(...d['@graph'])
      else nodes.push(d)
    } catch {
      // bloco malformado: ignora em vez de derrubar a coleta inteira
    }
  }
  return nodes
}

/** Lê o objeto `__NEXT_DATA__` que apps Next.js embutem no HTML. */
export function extrairNextData(html: string): Node | null {
  const m = html.match(
    /<script id="__NEXT_DATA__" type="application\/json"[^>]*>([\s\S]*?)<\/script>/
  )
  if (!m) return null
  try {
    return JSON.parse(m[1])
  } catch {
    return null
  }
}

/** "R$ 930.000" → 930000. Devolve null para vazio, zero ou lixo. */
export function moeda(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null
  const limpo = String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number(limpo)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function numero(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(String(v).replace(',', '.').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

/**
 * Os portais gravam o mesmo bairro em caixas diferentes ("BOM FIM" e
 * "Bom Fim"), o que faria a vitrine listar um bairro duas vezes. Title Case
 * resolve, preservando as minúsculas de ligação ("Moinhos de Vento").
 */
const LIGACOES = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])

export function normalizarBairro(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((p, i) => (i > 0 && LIGACOES.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ')
}

/**
 * Converte um número escrito por humano em pt-BR ou en-US.
 *
 * O ponto é ambíguo: em "1.234" ele separa milhar, em "113.75" ele é decimal.
 * Os portais misturam as duas convenções no mesmo campo — a Foxter escreve
 * "113.75 m²" enquanto outros escrevem "1.200 m²". Tratar todo ponto como
 * milhar transformava 113,75 m² num apartamento de 11.375 m², o que por sua
 * vez destruía o preço por m² e, com ele, qualquer comparação de mercado.
 *
 * Regra: se houver vírgula, ela é o decimal e o ponto é milhar. Se só houver
 * ponto e o último grupo tiver 1 ou 2 dígitos, esse ponto é decimal.
 */
export function numeroHumano(s: string): number | null {
  const bruto = s.trim()
  if (!bruto) return null

  let normalizado: string
  if (bruto.includes(',')) {
    normalizado = bruto.replace(/\./g, '').replace(',', '.')
  } else {
    const grupos = bruto.split('.')
    const ultimo = grupos[grupos.length - 1]
    normalizado =
      grupos.length > 1 && ultimo.length <= 2
        ? grupos.slice(0, -1).join('') + '.' + ultimo
        : grupos.join('')
  }

  const n = Number(normalizado)
  return Number.isFinite(n) ? n : null
}

/** Extrai dormitórios e área privativa de um título de anúncio. */
export function doTitulo(titulo: string): { dorm: number | null; area: number | null } {
  const mDorm = titulo.match(/(\d+)\s*(?:quartos?|dormit[óo]rios?|dorms?)/i)
  const mArea = titulo.match(/([\d.,]+)\s*m[²2]/i)
  return {
    dorm: mDorm ? Number(mDorm[1]) : null,
    area: mArea ? numeroHumano(mArea[1]) : null,
  }
}
