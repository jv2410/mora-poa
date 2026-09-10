import type { Imovel } from '../tipos'
import type { Fonte } from './tipos'
import { extrairNextData, normalizarBairro, moeda, numero, doTitulo } from './comum'

const BASE = 'https://guarida.com.br'

const BAIRROS = [
  'bom-fim',
  'petropolis',
  'moinhos-de-vento',
  'menino-deus',
  'cidade-baixa',
  'santana',
  'auxiliadora',
  'bela-vista',
]

/**
 * A Guarida não publica JSON-LD, mas embute o imóvel inteiro já normalizado no
 * `__NEXT_DATA__` — inclusive latitude/longitude e as propriedades tipadas.
 * É a fonte mais rica das três.
 */
export function parsearImovel(html: string, url: string): Imovel | null {
  const next = extrairNextData(html)
  const im = next?.props?.pageProps?.imovel
  if (!im?.codigo) return null

  const preco = moeda(im.valores?.valor)
  if (preco == null) return null

  // propriedades é uma lista de {slug, valor} — vira um mapa.
  const props: Record<string, string> = {}
  for (const p of im.propriedades ?? []) if (p?.slug) props[p.slug] = p.valor

  const titulo: string = im.titulo ?? ''
  const area = numero(props.area) ?? doTitulo(titulo).area

  const bairroBreadcrumb = (im.breadcrumbs ?? []).find(
    (b: any) => b?.tipo === 'bairro'
  )?.nome
  const bairro = normalizarBairro(
    bairroBreadcrumb ?? im.endereco?.split(' - ')[1] ?? 'Porto Alegre'
  )

  const caracteristicas: string[] = [
    ...(im.caracteristicas?.imovel ?? []),
    ...(im.caracteristicas?.condominio ?? []),
  ]
    .map((c: any) => (typeof c === 'string' ? c : c?.nome))
    .filter(Boolean)

  const fotos: string[] = (im.fotos ?? [])
    .slice()
    .sort((a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .map((f: any) => f?.url)
    .filter(Boolean)

  return {
    fonte: 'guarida',
    codigo_origem: `guarida-${im.codigo}`,
    url_origem: url,
    titulo,
    descricao: im.descricao ?? null,
    preco,
    condominio: moeda(im.valores?.condominio),
    iptu: moeda(im.valores?.iptu),
    area,
    area_total: null,
    dormitorios: numero(props.dormitorios) ?? doTitulo(titulo).dorm,
    suites: numero(props.suite),
    banheiros: numero(props.banheiro),
    vagas: numero(props.vaga ?? props.garagem ?? props.vagas),
    bairro,
    endereco: im.logradouro ?? im.endereco ?? null,
    cidade: 'Porto Alegre',
    latitude: numero(im.latitude),
    longitude: numero(im.longitude),
    caracteristicas,
    fotos,
    publicado_em: null,
    dados_conflitantes: false,
  }
}

/** Guarda o path inteiro, porque o bairro e o tipo fazem parte da URL. */
export function extrairIdsDaListagem(html: string): string[] {
  const paths = [...html.matchAll(/\/imovel\/comprar\/[a-z0-9-]+\/apartamento\/(\d+)/g)].map(
    (m) => m[0]
  )
  return [...new Set(paths)]
}

export const guarida: Fonte = {
  nome: 'guarida',
  rotulo: 'Guarida Imóveis',
  listagens: BAIRROS.map((b) => `${BASE}/busca/comprar/residencial/${b}-porto-alegre-rs`),
  extrairIds: extrairIdsDaListagem,
  urlDetalhe: (path) => `${BASE}${path}`,
  parsear: parsearImovel,
}
