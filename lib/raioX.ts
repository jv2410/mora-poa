import { getPool } from './db'

/**
 * Preço por m² tem cauda suja: um anúncio com área digitada errada vira
 * R$ 200/m² ou R$ 90 mil/m² e destrói qualquer mediana. Cortamos fora da
 * faixa plausível para Porto Alegre antes de agregar — e dizemos quantos
 * foram cortados, em vez de esconder.
 */
const FAIXA_PLAUSIVEL = 'preco_m2 BETWEEN 1500 AND 40000'
const AMOSTRA_MINIMA = 5

export type LinhaBairro = {
  bairro: string
  n: number
  p25: number
  mediana: number
  p75: number
  preco_mediano: number
  area_mediana: number
  dorm_tipico: number
}

export type RaioX = {
  bairros: LinhaBairro[]
  geral: { mediana: number; n: number; bairros: number; descartados: number }
  maisCaro: LinhaBairro
  maisBarato: LinhaBairro
  razao: number
  dormFiltro: number | null
}

export async function raioX(dorm?: number | null): Promise<RaioX> {
  const pool = getPool()
  const filtroDorm = dorm ? 'AND dormitorios = $1' : ''
  const params = dorm ? [dorm] : []

  const { rows: bairros } = await pool.query(
    `SELECT bairro,
            count(*)::int n,
            round(percentile_cont(0.25) WITHIN GROUP (ORDER BY preco_m2))::int p25,
            round(percentile_cont(0.50) WITHIN GROUP (ORDER BY preco_m2))::int mediana,
            round(percentile_cont(0.75) WITHIN GROUP (ORDER BY preco_m2))::int p75,
            round(percentile_cont(0.50) WITHIN GROUP (ORDER BY preco))::int preco_mediano,
            round(percentile_cont(0.50) WITHIN GROUP (ORDER BY area))::int area_mediana,
            round(percentile_cont(0.50) WITHIN GROUP (ORDER BY dormitorios))::int dorm_tipico
     FROM imoveis
     WHERE ${FAIXA_PLAUSIVEL} ${filtroDorm}
     GROUP BY bairro
     HAVING count(*) >= ${AMOSTRA_MINIMA}
     ORDER BY mediana DESC`,
    params
  )

  const { rows: g } = await pool.query(
    `SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY preco_m2))::int mediana,
            count(*)::int n,
            (SELECT count(*)::int FROM imoveis
              WHERE preco_m2 IS NOT NULL AND NOT (${FAIXA_PLAUSIVEL})) descartados
     FROM imoveis WHERE ${FAIXA_PLAUSIVEL} ${filtroDorm}`,
    params
  )

  const maisCaro = bairros[0]
  const maisBarato = bairros[bairros.length - 1]

  return {
    bairros,
    geral: {
      mediana: g[0]?.mediana ?? 0,
      n: g[0]?.n ?? 0,
      bairros: bairros.length,
      descartados: g[0]?.descartados ?? 0,
    },
    maisCaro,
    maisBarato,
    razao:
      maisCaro && maisBarato ? Math.round((maisCaro.mediana / maisBarato.mediana) * 10) / 10 : 0,
    dormFiltro: dorm ?? null,
  }
}

/** Quantos dormitórios existem no banco, para montar o filtro. */
export async function dormsDisponiveis(): Promise<number[]> {
  const { rows } = await getPool().query(
    `SELECT dormitorios d, count(*) n FROM imoveis
     WHERE ${FAIXA_PLAUSIVEL} AND dormitorios BETWEEN 1 AND 4
     GROUP BY d HAVING count(*) >= 20 ORDER BY d`
  )
  return rows.map((r) => Number(r.d))
}

/**
 * Compara dois bairros de frente. Usado pela tool que a IA chama quando a
 * pessoa pergunta "vale mais a pena o Bom Fim ou a Cidade Baixa?".
 */
export async function compararBairros(a: string, b: string) {
  const { rows } = await getPool().query(
    `SELECT bairro,
            count(*)::int n,
            round(percentile_cont(0.5) WITHIN GROUP (ORDER BY preco_m2))::int mediana_m2,
            round(percentile_cont(0.5) WITHIN GROUP (ORDER BY preco))::int preco_mediano,
            round(percentile_cont(0.5) WITHIN GROUP (ORDER BY area))::int area_mediana,
            round(avg(coalesce(vagas, 0)) * 100)::int / 100.0 vagas_media,
            round(percentile_cont(0.5) WITHIN GROUP (ORDER BY custo_mensal))::int custo_mensal
     FROM imoveis
     WHERE ${FAIXA_PLAUSIVEL}
       AND lower(translate(bairro,
             'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
             'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')) = ANY($1)
     GROUP BY bairro`,
    [[a, b].map((s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase())]
  )
  return rows
}
