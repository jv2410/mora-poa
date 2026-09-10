import type { Imovel } from '../tipos'
import { normalizarBairro } from './comum'

/**
 * Zap, VivaReal e ImovelWeb (todos Grupo OLX) servem as páginas atrás de um
 * challenge JavaScript do Cloudflare. `fetch` recebe 403 porque não executa JS;
 * um navegador de verdade recebe a página normalmente. Por isso esta fonte usa
 * Playwright em vez do coletor comum.
 *
 * Duas decisões que valem registrar:
 *
 * 1. Coletamos da LISTAGEM, não da ficha. Cada página de resultados já traz
 *    preço, condomínio, IPTU, área, quartos, banheiros, vagas, bairro e foto —
 *    30 imóveis por requisição em vez de 30 requisições. Menos carga no
 *    servidor deles e coleta mais rápida.
 *
 * 2. A lista é virtualizada: o Zap mantém só os cards visíveis no DOM e
 *    descarta o resto ao rolar. Capturamos durante o scroll, acumulando por id.
 */

export type PortalOlx = {
  nome: string
  rotulo: string
  base: string
  listagens: string[]
}

export const ZAP: PortalOlx = {
  nome: 'zap',
  rotulo: 'Zap Imóveis',
  base: 'https://www.zapimoveis.com.br',
  listagens: [
    'https://www.zapimoveis.com.br/venda/apartamentos/rs+porto-alegre/',
    'https://www.zapimoveis.com.br/venda/apartamentos/rs+porto-alegre/?pagina=2',
    'https://www.zapimoveis.com.br/venda/apartamentos/rs+porto-alegre/?pagina=3',
    'https://www.zapimoveis.com.br/venda/apartamentos/rs+porto-alegre/?pagina=4',
  ],
}

// Atenção: o VivaReal usa o estado por extenso na URL ("rio-grande-do-sul"),
// não a sigla — com "rs" a página devolve 404.
export const VIVAREAL: PortalOlx = {
  nome: 'vivareal',
  rotulo: 'VivaReal',
  base: 'https://www.vivareal.com.br',
  listagens: [1, 2, 3, 4].map(
    (p) =>
      `https://www.vivareal.com.br/venda/rio-grande-do-sul/porto-alegre/apartamento_residencial/${p > 1 ? `?pagina=${p}` : ''}`
  ),
}

export const IMOVELWEB: PortalOlx = {
  nome: 'imovelweb',
  rotulo: 'ImovelWeb',
  base: 'https://www.imovelweb.com.br',
  listagens: [1, 2, 3, 4].map((p) =>
    p === 1
      ? 'https://www.imovelweb.com.br/apartamentos-venda-porto-alegre-rs.html'
      : `https://www.imovelweb.com.br/apartamentos-venda-porto-alegre-rs-pagina-${p}.html`
  ),
}

/** Bruto vindo do DOM, antes de virar Imovel. */
export type CardBruto = {
  id: string | null
  url: string
  bairro: string | null
  endereco: string | null
  area: number | null
  dormitorios: number | null
  banheiros: number | null
  vagas: number | null
  preco: number | null
  condominio: number | null
  iptu: number | null
  foto: string | null
  titulo: string | null
}

export function paraImovel(c: CardBruto, fonte: string): Imovel | null {
  if (!c.id || !c.preco || c.preco < 50000) return null

  return {
    fonte,
    codigo_origem: `${fonte}-${c.id}`,
    url_origem: c.url,
    titulo: c.titulo ?? `Apartamento em ${c.bairro ?? 'Porto Alegre'}`,
    descricao: null,
    preco: c.preco,
    condominio: c.condominio,
    iptu: c.iptu,
    area: c.area,
    area_total: null,
    dormitorios: c.dormitorios,
    suites: null,
    banheiros: c.banheiros,
    vagas: c.vagas,
    bairro: normalizarBairro(c.bairro ?? 'Porto Alegre'),
    endereco: c.endereco,
    cidade: 'Porto Alegre',
    latitude: null,
    longitude: null,
    caracteristicas: [],
    fotos: c.foto ? [c.foto] : [],
    publicado_em: null,
    dados_conflitantes: false,
  }
}
