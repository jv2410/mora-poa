import { getPool } from './db'

/**
 * Mapa de demanda não atendida. Agrega as buscas — inclusive, e sobretudo, as
 * que não acharam nada de Alta compatibilidade — e mostra o que o mercado
 * pediu e o estoque não tinha.
 *
 * O documento chama isso de pauta de captação gerada por dados de demanda
 * real, e diz que vale mais que o produto principal. A diferença entre este
 * bloco e um relatório qualquer é que ele só existe se as buscas estiverem
 * sendo gravadas desde antes: é retrospectivo por natureza, não dá para
 * reconstruir depois.
 */
export type Demanda = {
  /** O perfil pedido, já legível: "3 dorm · 2 vagas · até R$ 800 mil · Centro". */
  perfil: string
  buscas: number
  /** Quantos imóveis o estoque tinha para esse perfil, no momento da busca. */
  imoveis_encontrados: number
  /** Buscas desse perfil que não acharam nada de Alta compatibilidade. */
  sem_alta: number
}

const brl = (n: number) =>
  n >= 1000 ? `até R$ ${Math.round(n / 1000).toLocaleString('pt-BR')} mil` : `até R$ ${n}`

/**
 * Agrupa pelo que caracteriza o pedido, não pelo texto do briefing. Dois
 * corretores descrevem o mesmo cliente com palavras diferentes; o que precisa
 * agrupar é "3 dormitórios, 2 vagas, até 800 mil, Centro".
 *
 * O teto de preço entra arredondado para a centena de milhar porque R$ 780 mil
 * e R$ 800 mil são a mesma demanda para efeito de captação — sem isso cada
 * busca viraria o seu próprio grupo e o ranking não significaria nada.
 */
export async function demandaNaoAtendida(dias = 30, limite = 15): Promise<Demanda[]> {
  const { rows } = await getPool().query(
    `WITH normalizadas AS (
       SELECT
         (criterios->>'dorm_min')::int                              dorm,
         (criterios->>'vagas_min')::int                             vagas,
         -- Arredonda o teto para a centena de milhar mais próxima.
         round(((criterios->>'preco_max')::numeric) / 100000) * 100000 teto,
         -- Só o primeiro bairro: é o que define a região pedida.
         criterios->'bairros'->>0                                   bairro,
         alta,
         vale_apresentar
       FROM buscas
       WHERE criada_em > now() - ($1 || ' days')::interval
     )
     SELECT dorm, vagas, teto, bairro,
            count(*)::int                                   buscas,
            sum(alta + vale_apresentar)::int                encontrados,
            count(*) FILTER (WHERE alta = 0)::int           sem_alta
     FROM normalizadas
     GROUP BY dorm, vagas, teto, bairro
     -- O que interessa primeiro é o perfil que mais gente pediu e o estoque
     -- menos atendeu.
     ORDER BY count(*) FILTER (WHERE alta = 0) DESC, count(*) DESC
     LIMIT $2`,
    [String(dias), limite]
  )

  return rows.map((r) => {
    const partes = [
      r.dorm ? `${r.dorm} dorm` : null,
      r.vagas ? `${r.vagas} vaga${r.vagas > 1 ? 's' : ''}` : null,
      r.teto ? brl(Number(r.teto)) : null,
      r.bairro ?? null,
    ].filter(Boolean)

    return {
      perfil: partes.length ? partes.join(' · ') : 'busca sem critério definido',
      buscas: r.buscas,
      imoveis_encontrados: r.encontrados ?? 0,
      sem_alta: r.sem_alta,
    }
  })
}

/**
 * Saúde do cadastro: quantos imóveis estão fora dos matches por falta de dado,
 * e qual campo destrava mais imóveis se for preenchido.
 *
 * É o bloco que o documento diz ser impossível de contestar — porque a conta é
 * sobre o próprio estoque do cliente.
 */
export async function saudeDoCadastro() {
  const { rows } = await getPool().query(`
    SELECT count(*)::int                                                     total,
           count(*) FILTER (WHERE qualidade_cadastro < 60)::int              fila_correcao,
           round(avg(qualidade_cadastro))::int                               media,
           count(*) FILTER (WHERE condominio IS NULL)::int                   sem_condominio,
           count(*) FILTER (WHERE vagas IS NULL)::int                        sem_vagas,
           count(*) FILTER (WHERE area IS NULL)::int                         sem_area,
           count(*) FILTER (WHERE coalesce(array_length(fotos,1),0) < 3)::int poucas_fotos
    FROM imoveis
  `)
  return rows[0] as {
    total: number
    fila_correcao: number
    media: number
    sem_condominio: number
    sem_vagas: number
    sem_area: number
    poucas_fotos: number
  }
}
