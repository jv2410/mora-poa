import { getPool } from './db'

export type OpcaoBairro = {
  bairro: string
  n: number
  id: number
  preco: number
  area: number | null
  dormitorios: number | null
  vagas: number | null
  condominio: number | null
  foto: string | null
}

/**
 * O que um orçamento compra em cada bairro.
 *
 * Devolve, por bairro, o apartamento MEDIANO dentro do orçamento — não o mais
 * barato nem o mais caro. O mais barato de cada bairro seria sempre um caso
 * atípico e daria uma foto enganosa da cidade; o mediano é o que a pessoa
 * realmente encontra ao procurar ali.
 *
 * Cada linha é um imóvel de verdade, clicável. Não é simulação.
 */
export async function oQueCompra(orcamento: number, dorm?: number | null) {
  const filtro = dorm ? 'AND dormitorios >= $2' : ''
  const params: unknown[] = dorm ? [orcamento, dorm] : [orcamento]

  const { rows } = await getPool().query(
    `WITH candidatos AS (
       SELECT id, bairro, preco, area, dormitorios, vagas, condominio, fotos,
              percent_rank() OVER (PARTITION BY bairro ORDER BY preco) pr,
              count(*) OVER (PARTITION BY bairro) n
       FROM imoveis
       WHERE preco <= $1 ${filtro}
         AND preco_m2 BETWEEN 1500 AND 40000
     )
     SELECT DISTINCT ON (bairro)
            bairro, n::int, id, preco, area, dormitorios, vagas, condominio,
            fotos[1] foto
     FROM candidatos
     WHERE n >= 3
     ORDER BY bairro, abs(pr - 0.5)`,
    params
  )

  const opcoes: OpcaoBairro[] = rows.map((r) => ({
    bairro: r.bairro,
    n: Number(r.n),
    id: Number(r.id),
    preco: Number(r.preco),
    area: r.area == null ? null : Number(r.area),
    dormitorios: r.dormitorios == null ? null : Number(r.dormitorios),
    vagas: r.vagas == null ? null : Number(r.vagas),
    condominio: r.condominio == null ? null : Number(r.condominio),
    foto: r.foto ?? null,
  }))

  // Ordena pelo que o dinheiro rende: mais m² pelo mesmo dinheiro primeiro.
  opcoes.sort((a, b) => (b.area ?? 0) - (a.area ?? 0))

  return {
    orcamento,
    dorm: dorm ?? null,
    total_opcoes: opcoes.reduce((s, o) => s + o.n, 0),
    bairros: opcoes,
    melhor_area: opcoes[0] ?? null,
    pior_area: opcoes[opcoes.length - 1] ?? null,
  }
}
