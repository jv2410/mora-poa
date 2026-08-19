import type { Imovel } from '../tipos'
import type { Fonte } from './tipos'
import {
  type Node,
  primeiro,
  comoLista,
  extrairJsonLd,
  normalizarBairro,
  doTitulo,
} from './comum'

const BASE = 'https://www.auxiliadorapredial.com.br'

const BAIRROS = [
  'moinhos-de-vento',
  'cidade-baixa',
  'bom-fim',
  'santana',
  'petropolis',
  'menino-deus',
  'centro-historico',
]

function precoPorNome(specs: Node[], nome: string): number | null {
  const s = specs.find((x) => x.name === nome)
  return s?.price != null ? Number(s.price) : null
}

function propriedade(props: Node[], nome: string): number | null {
  const p = props.find((x) => x.name === nome)
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
  const specs = comoLista(offer.priceSpecification)
  const props = comoLista(listing.additionalProperty)

  const titulo: string = webpage?.name ?? listing.name ?? ''

  const dormLd = item.numberOfRooms != null ? Number(item.numberOfRooms) : null
  const areaLd = item.floorSize?.value != null ? Number(item.floorSize.value) : null
  const { dorm: dormTit, area: areaTit } = doTitulo(titulo)

  // As duas fontes medem coisas diferentes, e ambas estão certas: o título traz
  // a área PRIVATIVA e conta as suítes entre os quartos; o JSON-LD traz a área
  // TOTAL (com comum) e conta menos quartos. Guardamos as duas.
  const dormitorios = dormTit ?? dormLd
  const area = areaTit ?? areaLd
  const area_total = areaLd != null && areaTit != null && areaLd >= areaTit ? areaLd : null

  const preco = precoPorNome(specs, 'Valor do imóvel') ?? Number(offer.price)

  // A flag sinaliza anomalia real, não a diferença semântica acima — um aviso
  // que dispara em quase todo imóvel não informa nada e só corrói a confiança.
  const dados_conflitantes =
    (areaTit != null && areaLd != null && areaTit > areaLd + 1) || !Number.isFinite(preco)

  const partes = String(listing.name ?? '')
    .split(' - ')
    .map((s) => s.trim())
  const bairro = normalizarBairro(
    partes.length >= 3 ? partes[1] : (addr.addressLocality ?? 'Porto Alegre')
  )

  const fotos: string[] = comoLista(listing.image)
    .map((i: Node | string) => (typeof i === 'string' ? i : i.url))
    .filter(Boolean)

  return {
    fonte: 'auxiliadora',
    codigo_origem: `auxiliadora-${listing.identifier}`,
    url_origem: url,
    titulo,
    descricao: webpage?.description ?? null,
    preco,
    condominio: precoPorNome(specs, 'Condomínio'),
    iptu: precoPorNome(specs, 'IPTU'),
    area,
    area_total,
    dormitorios,
    suites: propriedade(props, 'Suítes'),
    banheiros:
      item.numberOfBathroomsTotal != null ? Number(item.numberOfBathroomsTotal) : null,
    vagas: propriedade(props, 'Vagas de Garagem'),
    bairro,
    endereco: addr.streetAddress ?? null,
    cidade: addr.addressLocality ?? 'Porto Alegre',
    latitude: null,
    longitude: null,
    caracteristicas: [],
    fotos,
    corretor_nome: primeiro(listing.provider).name ?? null,
    corretor_telefone: primeiro(listing.provider).telephone ?? null,
    publicado_em: listing.datePosted ?? null,
    dados_conflitantes,
  }
}

export function extrairIdsDaListagem(html: string): string[] {
  return [...new Set([...html.matchAll(/\/imovel\/venda\/(\d+)/g)].map((m) => m[1]))]
}

export const auxiliadora: Fonte = {
  nome: 'auxiliadora',
  rotulo: 'Auxiliadora Predial',
  listagens: BAIRROS.map((b) => `${BASE}/comprar/residencial/rs+porto-alegre+${b}`),
  extrairIds: extrairIdsDaListagem,
  urlDetalhe: (id) => `${BASE}/imovel/venda/${id}/apartamento+porto-alegre+rio-grande-do-sul`,
  parsear: parsearImovel,
}

export { normalizarBairro }
