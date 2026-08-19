import { getPool } from './db'

export type ContextoMercado = {
  amostra: number
  base_comparacao: string
  p25: number | null
  mediana: number | null
  p75: number | null
  percentil: number | null
  preco_m2_imovel: number | null
  delta_mediana_pct: number | null
  leitura: string
}

/**
 * Onde este imóvel cai na distribuição real de preço/m² dos comparáveis.
 *
 * É o que um corretor experiente faz de cabeça e o que o comprador não tem
 * como saber: R$ 9.500/m² no Moinhos é caro ou barato? Aqui a resposta sai da
 * própria base, com o tamanho da amostra sempre exposto — uma mediana de três
 * anúncios não é mediana de nada, e o usuário precisa poder ver isso.
 *
 * Estreita para largo: bairro + dormitórios → bairro → cidade. Nunca inventa
 * uma comparação que não tem lastro.
 */
export async function contextoMercado(imovelId: number): Promise<ContextoMercado | null> {
  const pool = getPool()

  const { rows: base } = await pool.query(
    'SELECT bairro, dormitorios, preco_m2 FROM imoveis WHERE id = $1',
    [imovelId]
  )
  if (!base[0]) return null

  const { bairro, dormitorios } = base[0]
  const precoM2 = base[0].preco_m2 == null ? null : Number(base[0].preco_m2)
  if (precoM2 == null) return null

  const MINIMO = 8

  const tentativas: { where: string; params: unknown[]; rotulo: string }[] = [
    {
      where: 'bairro = $1 AND dormitorios = $2',
      params: [bairro, dormitorios],
      rotulo: `${bairro}, ${dormitorios} ${dormitorios === 1 ? 'dormitório' : 'dormitórios'}`,
    },
    { where: 'bairro = $1', params: [bairro], rotulo: bairro },
    { where: 'true', params: [], rotulo: 'Porto Alegre' },
  ]

  for (const t of tentativas) {
    const { rows } = await pool.query(
      `WITH comparaveis AS (
         SELECT preco_m2 FROM imoveis
         WHERE ${t.where} AND preco_m2 IS NOT NULL
       )
       SELECT count(*)::int amostra,
              percentile_cont(0.25) WITHIN GROUP (ORDER BY preco_m2) p25,
              percentile_cont(0.50) WITHIN GROUP (ORDER BY preco_m2) mediana,
              percentile_cont(0.75) WITHIN GROUP (ORDER BY preco_m2) p75,
              (SELECT count(*) FROM comparaveis WHERE preco_m2 < $${t.params.length + 1})::float
                / NULLIF(count(*), 0) percentil
       FROM comparaveis`,
      [...t.params, precoM2]
    )

    const r = rows[0]
    const amostra = Number(r.amostra)
    const ultima = t.rotulo === 'Porto Alegre'

    if (amostra >= MINIMO || ultima) {
      const mediana = r.mediana == null ? null : Number(r.mediana)
      const delta =
        mediana && mediana > 0 ? ((precoM2 - mediana) / mediana) * 100 : null

      return {
        amostra,
        base_comparacao: t.rotulo,
        p25: r.p25 == null ? null : Number(r.p25),
        mediana,
        p75: r.p75 == null ? null : Number(r.p75),
        percentil: r.percentil == null ? null : Math.round(Number(r.percentil) * 100),
        preco_m2_imovel: precoM2,
        delta_mediana_pct: delta == null ? null : Math.round(delta * 10) / 10,
        leitura: leitura(amostra, delta),
      }
    }
  }

  return null
}

/**
 * Uma frase curta e honesta sobre o que o número significa. Fica aqui, em
 * TypeScript, e não no prompt — o modelo narra esta leitura, não a inventa.
 */
function leitura(amostra: number, delta: number | null): string {
  if (amostra < 5) return 'amostra pequena demais para uma leitura confiável'
  if (delta == null) return 'sem preço por m² para comparar'
  if (delta <= -20) return 'bem abaixo da mediana — investigue o motivo antes de comemorar'
  if (delta <= -8) return 'abaixo da mediana dos comparáveis'
  if (delta < 8) return 'em linha com a mediana dos comparáveis'
  if (delta < 20) return 'acima da mediana dos comparáveis'
  return 'bem acima da mediana — precisa justificar o prêmio'
}
