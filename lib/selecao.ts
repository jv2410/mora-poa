import { randomBytes } from 'node:crypto'
import { getPool } from './db'
import type { Faixa } from './tipos'
import { MOTIVOS, type Motivo, type StatusItem } from './selecaoTipos'

export { MOTIVOS } from './selecaoTipos'
export type { Motivo, StatusItem } from './selecaoTipos'

/**
 * A seleção é o funil do MORA: o que a IA sugeriu, o corretor aprovou e o
 * comprador respondeu. Sem ela não existe dado de desfecho — e sem dado de
 * desfecho o painel de retorno é teatro, como o próprio documento diz.
 *
 * A sequência de status é a do documento. Os cinco primeiros são registrados
 * aqui; "visita agendada" e "visita realizada" virão do CRM e por isso não
 * existem nesta tabela ainda.
 */

export type ItemSelecao = {
  id: number
  imovel_id: number
  faixa: Faixa
  ressalva: string | null
  status: StatusItem
  motivo_recusa: string | null
  visualizacoes: number
}

export type Selecao = {
  id: number
  token: string
  cliente: string | null
  criada_em: string
  enviada_em: string | null
  aberturas: number
  itens: ItemSelecao[]
}

/**
 * 24 bytes em base64url. A página do comprador não tem login — quem tem o
 * link vê a seleção — então o token precisa ser impossível de adivinhar por
 * tentativa. Um id sequencial na URL deixaria qualquer pessoa percorrer as
 * seleções de todos os corretores.
 */
function novoToken(): string {
  return randomBytes(24).toString('base64url')
}

export async function criarSelecao(args: {
  corretorId: string
  usuarioId?: number | null
  buscaId?: number | null
  cliente?: string | null
  itens: Array<{ imovel_id: number; faixa: Faixa; ressalva: string | null }>
}): Promise<string> {
  const pool = getPool()
  const cliente = await pool.connect()
  try {
    await cliente.query('BEGIN')
    const token = novoToken()
    const { rows } = await cliente.query(
      `INSERT INTO selecoes (token, corretor_id, usuario_id, busca_id, cliente)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        token,
        args.corretorId,
        args.usuarioId ?? null,
        args.buscaId ?? null,
        args.cliente ?? null,
      ]
    )
    const selecaoId = rows[0].id

    for (const it of args.itens) {
      // A faixa e a ressalva são congeladas aqui de propósito: o preço muda e a
      // coleta envelhece, mas o que o comprador leu tem que continuar sendo o
      // que ele leu.
      await cliente.query(
        `INSERT INTO selecao_itens (selecao_id, imovel_id, faixa, ressalva)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (selecao_id, imovel_id) DO NOTHING`,
        [selecaoId, it.imovel_id, it.faixa, it.ressalva]
      )
    }

    await cliente.query('COMMIT')
    return token
  } catch (erro) {
    await cliente.query('ROLLBACK')
    throw erro
  } finally {
    cliente.release()
  }
}

/** Marca a seleção como enviada ao comprador. */
export async function marcarEnviada(token: string): Promise<void> {
  await getPool().query(
    `UPDATE selecoes SET enviada_em = coalesce(enviada_em, now())
     WHERE token = $1`,
    [token]
  )
  await getPool().query(
    `UPDATE selecao_itens SET status = 'enviado', atualizado_em = now()
     WHERE selecao_id = (SELECT id FROM selecoes WHERE token = $1)
       AND status = 'aprovado_corretor'`,
    [token]
  )
}

export async function porToken(token: string): Promise<Selecao | null> {
  const { rows } = await getPool().query(
    `SELECT id, token, cliente, criada_em, enviada_em, aberturas
     FROM selecoes WHERE token = $1`,
    [token]
  )
  if (!rows[0]) return null

  const { rows: itens } = await getPool().query(
    `SELECT id, imovel_id, faixa, ressalva, status, motivo_recusa, visualizacoes
     FROM selecao_itens WHERE selecao_id = $1
     -- Alta compatibilidade primeiro: é o que o corretor quer que o comprador
     -- veja antes de cansar.
     ORDER BY CASE faixa WHEN 'alta' THEN 0 ELSE 1 END, id`,
    [rows[0].id]
  )

  return { ...rows[0], itens }
}

/**
 * Abertura do link. É sinal passivo, não aprovação — mas é o que alimenta
 * "abriu 6 vezes e não respondeu", que é o alerta mais acionável que o
 * corretor recebe.
 */
export async function registrarAbertura(token: string): Promise<void> {
  await getPool().query(
    `UPDATE selecoes
     SET aberturas = aberturas + 1, aberta_em = now()
     WHERE token = $1`,
    [token]
  )
  await getPool().query(
    `UPDATE selecao_itens SET status = 'visualizado', atualizado_em = now()
     WHERE selecao_id = (SELECT id FROM selecoes WHERE token = $1)
       AND status = 'enviado'`,
    [token]
  )
}

export async function registrarVisualizacaoItem(
  token: string,
  imovelId: number
): Promise<void> {
  await getPool().query(
    `UPDATE selecao_itens
     SET visualizacoes = visualizacoes + 1, atualizado_em = now()
     WHERE imovel_id = $2
       AND selecao_id = (SELECT id FROM selecoes WHERE token = $1)`,
    [token, imovelId]
  )
}

/**
 * A resposta do comprador. "Quero visitar" é a aprovação que conta no funil;
 * "não é pra mim" com motivo é o que volta para refinar a próxima busca.
 */
export async function responder(
  token: string,
  imovelId: number,
  resposta: 'quero_visitar' | 'nao_e_pra_mim',
  motivo?: Motivo | null
): Promise<void> {
  const status = resposta === 'quero_visitar' ? 'aprovado_comprador' : 'recusado'
  await getPool().query(
    `UPDATE selecao_itens
     SET status = $3,
         motivo_recusa = $4,
         atualizado_em = now()
     WHERE imovel_id = $2
       AND selecao_id = (SELECT id FROM selecoes WHERE token = $1)`,
    [token, imovelId, status, resposta === 'nao_e_pra_mim' ? (motivo ?? null) : null]
  )
}

/** As seleções de um corretor, com o andamento de cada uma. */
export async function doCorretor(corretorId: string, limite = 20, usuarioId?: number | null) {
  const { rows } = await getPool().query(
    `SELECT s.token, s.cliente, s.criada_em, s.enviada_em, s.aberturas,
            count(i.*)::int                                            total,
            count(*) FILTER (WHERE i.status = 'aprovado_comprador')::int aprovados,
            count(*) FILTER (WHERE i.status = 'recusado')::int           recusados
     FROM selecoes s
     LEFT JOIN selecao_itens i ON i.selecao_id = s.id
     -- Casa pelos dois: o histórico anônimo deste navegador e o que já está
     -- atribuído ao usuário logado.
     WHERE s.corretor_id = $1 OR ($3::int IS NOT NULL AND s.usuario_id = $3)
     GROUP BY s.id
     ORDER BY s.criada_em DESC
     LIMIT $2`,
    [corretorId, limite, usuarioId ?? null]
  )
  return rows
}

/**
 * Registra a busca. Chamado em toda busca, inclusive — e principalmente — nas
 * que não acharam nada: é a busca vazia que vira pauta de captação no mapa de
 * demanda não atendida.
 */
export async function registrarBusca(args: {
  corretorId: string | null
  usuarioId?: number | null
  briefing: string | null
  criterios: unknown
  alta: number
  valeApresentar: number
}): Promise<number | null> {
  try {
    // usuario_id é o que o painel agrega. Sem ele, a busca de alguém logado
    // ficaria invisível no próprio painel dessa pessoa — o corretor_id só
    // serve para o histórico anônimo de antes do login.
    const { rows } = await getPool().query(
      `INSERT INTO buscas
         (corretor_id, usuario_id, briefing, criterios, alta, vale_apresentar)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        args.corretorId,
        args.usuarioId ?? null,
        args.briefing,
        JSON.stringify(args.criterios ?? {}),
        args.alta,
        args.valeApresentar,
      ]
    )
    return rows[0].id
  } catch {
    // Telemetria nunca derruba a busca: se o registro falhar, o corretor ainda
    // recebe os imóveis. Perder uma linha de histórico é barato; perder a
    // resposta ao lead não é.
    return null
  }
}

/** Imóveis do estoque que nenhuma seleção levou — o "estoque morto" do documento. */
export async function estoqueMorto(dias = 90, limite = 50) {
  const { rows } = await getPool().query(
    `SELECT i.id, i.bairro, i.preco, i.qualidade_cadastro,
            i.condominio IS NULL AS sem_condominio,
            i.vagas IS NULL      AS sem_vagas,
            coalesce(array_length(i.fotos, 1), 0) < 3 AS poucas_fotos
     FROM imoveis i
     WHERE NOT EXISTS (
       SELECT 1 FROM selecao_itens si
       JOIN selecoes s ON s.id = si.selecao_id
       WHERE si.imovel_id = i.id AND s.criada_em > now() - ($1 || ' days')::interval
     )
     ORDER BY i.qualidade_cadastro ASC, i.preco DESC
     LIMIT $2`,
    [String(dias), limite]
  )
  return rows
}
