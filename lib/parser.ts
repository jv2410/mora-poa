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

  // As duas fontes medem coisas diferentes, e ambas estão certas:
  //   - o título traz a área PRIVATIVA e conta as suítes entre os quartos;
  //   - o JSON-LD traz a área TOTAL (com comum) e conta menos quartos.
  // Guardamos as duas. `area` é a privativa, porque é o número que aparece no
  // anúncio e o que o comprador usa para comparar imóveis.
  const dormitorios = dormTit ?? dormLd
  const area = areaTit ?? areaLd
  const area_total = areaLd != null && areaTit != null && areaLd >= areaTit ? areaLd : null

  // A flag sinaliza anomalia real, não a diferença semântica acima — um aviso
  // que dispara em quase todo imóvel não informa nada e só corrói a confiança.
  // Nota: JSON-LD com MAIS quartos que o título também é semântico — em studio
  // e garden ele conta a sala como cômodo. Não entra aqui.
  const dados_conflitantes =
    // área privativa maior que a total é fisicamente impossível
    (areaTit != null && areaLd != null && areaTit > areaLd + 1) ||
    // sem preço utilizável
    !Number.isFinite(
      precoPorNome(comoLista(offer.priceSpecification), 'Valor do imóvel') ??
        Number(offer.price)
    )

  // listing.name tem o formato "Apartamento - Centro Histórico - Porto Alegre"
  const partes = String(listing.name ?? '')
    .split(' - ')
    .map((s) => s.trim())
  const bairroBruto =
    partes.length >= 3 ? partes[1] : (addr.addressLocality ?? 'Porto Alegre')
  const bairro = normalizarBairro(bairroBruto)

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
    area_total,
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

/**
 * O portal grava o mesmo bairro em caixas diferentes ("BOM FIM" e "Bom Fim"),
 * o que faria a vitrine listar um bairro duas vezes. Title Case resolve,
 * preservando as minúsculas de ligação usadas em nomes ("Moinhos de Vento").
 */
const LIGACOES = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])

export function normalizarBairro(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((p, i) => (i > 0 && LIGACOES.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ')
}

export function extrairIdsDaListagem(html: string): string[] {
  const ids = [...html.matchAll(/\/imovel\/venda\/(\d+)/g)].map((m) => m[1])
  return [...new Set(ids)]
}
