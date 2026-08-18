import type { Imovel } from './tipos'

type Node = Record<string, any>

function extrairJsonLd(html: string): Node[] {
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

/**
 * JSON-LD permite que qualquer propriedade seja um objeto ou um array de
 * objetos. A Auxiliadora usa array em `offers` e objeto em `itemOffered`,
 * então nunca assuma a forma — desembrulhe sempre.
 */
function primeiro(v: unknown): Node {
  if (Array.isArray(v)) return (v[0] ?? {}) as Node
  return (v ?? {}) as Node
}

function comoLista(v: unknown): Node[] {
  if (Array.isArray(v)) return v as Node[]
  return v ? [v as Node] : []
}

function precoPorNome(specs: Node[] | undefined, nome: string): number | null {
  const s = (specs ?? []).find((x) => x.name === nome)
  return s?.price != null ? Number(s.price) : null
}

function propriedade(props: Node[] | undefined, nome: string): number | null {
  const p = (props ?? []).find((x) => x.name === nome)
  return p?.value != null ? Number(p.value) : null
}

export function parsearImovel(html: string, url: string): Imovel | null {
  const nodes = extrairJsonLd(html)
  const listing = nodes.find((n) => n['@type'] === 'RealEstateListing')
  const webpage = nodes.find((n) => n['@type'] === 'WebPage')
  if (!listing) return null

  const offer = primeiro(listing.offers)
  const item = primeiro(offer.itemOffered)
  const addr = primeiro(item.address)

  const titulo: string = webpage?.name ?? listing.name ?? ''

  // Duas fontes concorrentes para dormitórios e área.
  const dormLd = item.numberOfRooms != null ? Number(item.numberOfRooms) : null
  const areaLd = item.floorSize?.value != null ? Number(item.floorSize.value) : null

  const mDorm = titulo.match(/(\d+)\s*(?:quartos?|dormit[óo]rios?)/i)
  const mArea = titulo.match(/([\d.,]+)\s*m²/i)
  const dormTit = mDorm ? Number(mDorm[1]) : null
  const areaTit = mArea ? Number(mArea[1].replace(/\./g, '').replace(',', '.')) : null

  // O título do anúncio é a fonte de verdade quando diverge do JSON-LD:
  // é o que o corretor escreveu e o que o comprador lê.
  const dormitorios = dormTit ?? dormLd
  const area = areaTit ?? areaLd
  const dados_conflitantes =
    (dormTit != null && dormLd != null && dormTit !== dormLd) ||
    (areaTit != null && areaLd != null && Math.abs(areaTit - areaLd) > 1)

  // listing.name tem o formato "Apartamento - Centro Histórico - Porto Alegre"
  const partes = String(listing.name ?? '')
    .split(' - ')
    .map((s) => s.trim())
  const bairro = partes.length >= 3 ? partes[1] : (addr.addressLocality ?? 'Porto Alegre')

  const fotos: string[] = (listing.image ?? [])
    .map((i: Node | string) => (typeof i === 'string' ? i : i.url))
    .filter(Boolean)

  return {
    codigo_origem: String(listing.identifier),
    url_origem: url,
    titulo,
    descricao: webpage?.description ?? null,
    preco:
      precoPorNome(comoLista(offer.priceSpecification), 'Valor do imóvel') ??
      Number(offer.price),
    condominio: precoPorNome(comoLista(offer.priceSpecification), 'Condomínio'),
    iptu: precoPorNome(comoLista(offer.priceSpecification), 'IPTU'),
    area,
    dormitorios,
    suites: propriedade(comoLista(listing.additionalProperty), 'Suítes'),
    banheiros:
      item.numberOfBathroomsTotal != null ? Number(item.numberOfBathroomsTotal) : null,
    vagas: propriedade(comoLista(listing.additionalProperty), 'Vagas de Garagem'),
    bairro,
    endereco: addr.streetAddress ?? null,
    cidade: addr.addressLocality ?? 'Porto Alegre',
    fotos,
    corretor_nome: primeiro(listing.provider).name ?? null,
    corretor_telefone: primeiro(listing.provider).telephone ?? null,
    publicado_em: listing.datePosted ?? null,
    dados_conflitantes,
  }
}

export function extrairIdsDaListagem(html: string): string[] {
  const ids = [...html.matchAll(/\/imovel\/venda\/(\d+)/g)].map((m) => m[1])
  return [...new Set(ids)]
}
