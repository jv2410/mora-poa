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
  condominio_m2: CondominioM2 | null
  eficiencia: Eficiencia | null
}

/**
 * Condomínio por m², comparado com imóveis de porte parecido no mesmo bairro.
 *
 * A comparação é dentro de uma faixa de área (±20 m²) de propósito: custo de
 * prédio é largamente fixo, então apartamento pequeno sempre tem condomínio
 * por m² maior. Comparar um JK contra a mediana geral condenaria todo JK.
 */
export type CondominioM2 = {
  valor: number
  mediana: number
  percentil: number
  amostra: number
  leitura: string
}

/** Quanto da área que você paga é realmente sua. */
export type Eficiencia = {
  fator: number
  area_privativa: number
  area_total: number
  m2_de_area_comum: number
  mediana_bairro: number | null
  amostra: number
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

      const [cond, efi] = await Promise.all([
        condominioM2(imovelId),
        eficienciaDaPlanta(imovelId),
      ])

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
        condominio_m2: cond,
        eficiencia: efi,
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


async function condominioM2(imovelId: number): Promise<CondominioM2 | null> {
  const pool = getPool()
  const { rows: base } = await pool.query(
    `SELECT bairro, area, condominio, condominio / NULLIF(area, 0) valor
     FROM imoveis WHERE id = $1`,
    [imovelId]
  )
  const b = base[0]
  if (!b?.valor || !b.area) return null
  const valor = Number(b.valor)

  const { rows } = await pool.query(
    `WITH pares AS (
       SELECT condominio / NULLIF(area, 0) v FROM imoveis
       WHERE bairro = $1 AND condominio IS NOT NULL AND area IS NOT NULL
         AND area BETWEEN $2 - 20 AND $2 + 20
     )
     SELECT count(*)::int amostra,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY v) mediana,
            (SELECT count(*) FROM pares WHERE v < $3)::float / NULLIF(count(*),0) pct
     FROM pares`,
    [b.bairro, Number(b.area), valor]
  )

  const r = rows[0]
  const amostra = Number(r.amostra)
  if (amostra < 5 || r.mediana == null) return null

  const mediana = Number(r.mediana)
  const delta = Math.round(((valor - mediana) / mediana) * 100)

  return {
    valor: Math.round(valor * 100) / 100,
    mediana: Math.round(mediana * 100) / 100,
    percentil: Math.round(Number(r.pct) * 100),
    amostra,
    leitura:
      delta >= 40
        ? `${delta}% acima dos vizinhos de mesmo porte — prédio caro de manter`
        : delta <= -30
          ? `${Math.abs(delta)}% abaixo dos vizinhos de mesmo porte`
          : 'em linha com prédios de porte parecido no bairro',
  }
}

async function eficienciaDaPlanta(imovelId: number): Promise<Eficiencia | null> {
  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT bairro, area, area_total, eficiencia FROM imoveis WHERE id = $1`,
    [imovelId]
  )
  const b = rows[0]
  if (!b?.eficiencia || !b.area_total) return null

  const { rows: med } = await pool.query(
    `SELECT count(*)::int amostra,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY eficiencia) mediana
     FROM imoveis WHERE bairro = $1 AND eficiencia IS NOT NULL`,
    [b.bairro]
  )

  const amostra = Number(med[0]?.amostra ?? 0)

  return {
    fator: Math.round(Number(b.eficiencia) * 1000) / 1000,
    area_privativa: Number(b.area),
    area_total: Number(b.area_total),
    m2_de_area_comum: Math.round((Number(b.area_total) - Number(b.area)) * 10) / 10,
    mediana_bairro: amostra >= 5 && med[0].mediana ? Math.round(Number(med[0].mediana) * 1000) / 1000 : null,
    amostra,
  }
}
