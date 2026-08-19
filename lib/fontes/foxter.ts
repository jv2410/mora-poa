import type { Imovel } from '../tipos'
import type { Fonte } from './tipos'
import { extrairJsonLd, normalizarBairro, doTitulo, moeda, numero, comoLista } from './comum'

const BASE = 'https://www.foxterciaimobiliaria.com.br'

const BAIRROS = [
  'petropolis',
  'auxiliadora',
  'bela-vista',
  'jardim-europa',
  'moinhos-de-vento',
  'menino-deus',
  'tres-figueiras',
]

/**
 * A Foxter publica dois nós úteis: `Product` (sku, preço, todas as fotos) e
 * `Apartment` (nome com dormitórios, endereço). Os valores de condomínio e
 * IPTU não estão no JSON-LD — vêm do HTML renderizado.
 */
export function parsearImovel(html: string, url: string): Imovel | null {
  const nodes = extrairJsonLd(html)
  const produto = nodes.find((n) => n['@type'] === 'Product')
  const apto = nodes.find((n) => n['@type'] === 'Apartment')
  if (!produto && !apto) return null

  const oferta = comoLista(produto?.offers)[0] ?? {}
  const preco = moeda(oferta.price)
  if (preco == null) return null

  const titulo: string = apto?.name ?? produto?.description ?? ''
  const descricao: string = produto?.description ?? apto?.description ?? ''

  // "Foxter vende Apartamento Residencial , 39m2, 2 dorms em condomínio no
  // bairro Petrópolis em Porto Alegre" — dormitórios e área saem daqui.
  const doTit = doTitulo(titulo)
  const doDesc = doTitulo(descricao)
  const dormitorios = doTit.dorm ?? doDesc.dorm ?? numero(apto?.numberOfRooms)
  const area = doTit.area ?? doDesc.area

  const mBairro = descricao.match(/bairro\s+([^,]+?)\s+em\s+Porto Alegre/i)
  const endereco: string = String(apto?.address ?? '')
  const bairro = normalizarBairro(
    mBairro?.[1] ?? endereco.split(',')[1]?.trim() ?? 'Porto Alegre'
  )

  const fotos = comoLista(produto?.image)
    .map((i: any) => (typeof i === 'string' ? i : i?.url))
    .filter(Boolean)

  return {
    fonte: 'foxter',
    codigo_origem: `foxter-${produto?.sku ?? url.match(/\/imovel\/(\d+)/)?.[1]}`,
    url_origem: url,
    titulo: titulo || descricao.slice(0, 120),
    descricao: descricao || null,
    preco,
    condominio: valorRotulado(html, 'condom'),
    iptu: valorRotulado(html, 'iptu'),
    area,
    area_total: null,
    dormitorios,
    suites: null,
    banheiros: null,
    vagas: numero(html.match(/(\d+)\s*vagas?\s*(?:de\s*)?garagem/i)?.[1]),
    bairro,
    endereco: endereco || null,
    cidade: 'Porto Alegre',
    latitude: null,
    longitude: null,
    caracteristicas: [],
    fotos,
    corretor_nome: 'Foxter Cia Imobiliária',
    corretor_telefone: '+555130837777',
    publicado_em: null,
    dados_conflitantes: false,
  }
}

/** Acha "Condomínio R$ 1.306" e afins no HTML renderizado. */
function valorRotulado(html: string, rotulo: string): number | null {
  const re = new RegExp(`${rotulo}[^R]{0,60}R\\$\\s?([\\d.,]+)`, 'i')
  return moeda(html.match(re)?.[1])
}

export function extrairIdsDaListagem(html: string): string[] {
  return [...new Set([...html.matchAll(/\/imovel\/(\d+)/g)].map((m) => m[1]))]
}

export const foxter: Fonte = {
  nome: 'foxter',
  rotulo: 'Foxter Cia Imobiliária',
  listagens: BAIRROS.map(
    (b) =>
      `${BASE}/imoveis/a-venda/em-porto-alegre-rs/apartamento-ou-apartamento-garden/no-bairro-${b}`
  ),
  extrairIds: extrairIdsDaListagem,
  urlDetalhe: (id) => `${BASE}/imovel/${id}`,
  parsear: parsearImovel,
}
