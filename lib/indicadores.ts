import { getPool } from './db'

/**
 * Os indicadores do painel, nas camadas do documento.
 *
 * A regra que organiza este arquivo: a MORA reivindica autoria do que ela
 * própria mede (camadas 1, 2 e 5) e nunca fabrica o que depende do CRM
 * (camadas 3 e 4). Enquanto não houver CRM conectado, esses números não vêm
 * como zero nem como estimativa — vêm como `null`, e a interface mostra o
 * bloco explicando o que falta.
 *
 * Zero e "não medido" são coisas diferentes. Mostrar zero visita quando o
 * problema é que ninguém conectou o CRM é o jeito mais rápido de o diretor
 * concluir que a ferramenta não serve.
 */

/** Camada 1: eficiência. Medida desde o primeiro dia. */
export type Eficiencia = {
  buscas: number
  imoveis_analisados: number
  /** Horas economizadas, com os componentes da fórmula para poder ser auditada. */
  horas_economizadas: number
  formula: {
    buscas: number
    media_por_busca: number
    minutos_por_30: number
  }
}

/** Camada 2: qualidade do match. Principal KPI de produto. */
export type Qualidade = {
  buscas: number
  /** % das buscas em que ao menos um imóvel foi enviado ao comprador. */
  taxa_aproveitamento: number | null
  selecoes_enviadas: number
  imoveis_enviados: number
  media_enviados_por_selecao: number | null
  buscas_sem_alta: number
  aprovados_comprador: number
  recusados: number
  /** Motivos de recusa agregados — onde o match erra. */
  motivos: Array<{ motivo: string; n: number }>
}

/**
 * Camadas 3 e 4: resultado comercial e retorno.
 *
 * Lê das tabelas `visitas` e `negocios`, que são as mesmas que a sincronização
 * com o CRM preenche. O painel não sabe — nem precisa saber — se a linha foi
 * registrada aqui ou veio de fora: o campo `origem` guarda isso para auditoria,
 * e o cálculo é idêntico nos dois casos.
 */
export type Comercial = {
  aprovacoes_comprador: number
  visitas: number
  visitas_realizadas: number
  propostas: number
  vendas: number
  /** Soma das vendas ganhas cujo imóvel passou por uma seleção da MORA. */
  vgv_influenciado: number
  comissao_potencial: number
  /** Comissão influenciada ÷ mensalidade. Null sem mensalidade cadastrada. */
  multiplo_retorno: number | null
  custo_por_visita: number | null
}

const DIAS = 30

/**
 * A fórmula de horas economizadas, que o documento exige que seja visível:
 * buscas × média de imóveis por busca ÷ 30 × minutos informados no cadastro.
 *
 * Fazemos a conta aqui, em código testado, e devolvemos as partes junto do
 * resultado — para a interface poder mostrar de onde o número saiu. Número sem
 * fórmula é o jeito mais rápido de perder um cliente técnico.
 */
export async function eficiencia(
  usuarioIds: number[],
  minutosPor30: number,
  dias = DIAS
): Promise<Eficiencia> {
  if (usuarioIds.length === 0) {
    return {
      buscas: 0,
      imoveis_analisados: 0,
      horas_economizadas: 0,
      formula: { buscas: 0, media_por_busca: 0, minutos_por_30: minutosPor30 },
    }
  }

  const { rows } = await getPool().query(
    `SELECT count(*)::int buscas,
            -- coalesce para buscas gravadas antes de a coluna existir.
            coalesce(sum(coalesce(analisados, alta + vale_apresentar)), 0)::int analisados
     FROM buscas
     WHERE usuario_id = ANY($1) AND criada_em > now() - ($2 || ' days')::interval`,
    [usuarioIds, String(dias)]
  )

  const buscas = rows[0].buscas as number
  const analisados = rows[0].analisados as number
  const mediaPorBusca = buscas === 0 ? 0 : analisados / buscas
  const horas = (analisados / 30) * minutosPor30 / 60

  return {
    buscas,
    imoveis_analisados: analisados,
    horas_economizadas: Math.round(horas * 10) / 10,
    formula: {
      buscas,
      media_por_busca: Math.round(mediaPorBusca),
      minutos_por_30: minutosPor30,
    },
  }
}

export async function qualidade(usuarioIds: number[], dias = DIAS): Promise<Qualidade> {
  const vazio: Qualidade = {
    buscas: 0,
    taxa_aproveitamento: null,
    selecoes_enviadas: 0,
    imoveis_enviados: 0,
    media_enviados_por_selecao: null,
    buscas_sem_alta: 0,
    aprovados_comprador: 0,
    recusados: 0,
    motivos: [],
  }
  if (usuarioIds.length === 0) return vazio

  const janela = [usuarioIds, String(dias)]

  const { rows: b } = await getPool().query(
    `SELECT count(*)::int total,
            count(*) FILTER (WHERE alta = 0)::int sem_alta,
            -- Buscas que viraram seleção enviada: o numerador da taxa de
            -- aproveitamento, que o documento chama de principal KPI interno
            -- de qualidade.
            count(*) FILTER (WHERE EXISTS (
              SELECT 1 FROM selecoes s
              WHERE s.busca_id = buscas.id AND s.enviada_em IS NOT NULL
            ))::int com_envio
     FROM buscas
     WHERE usuario_id = ANY($1) AND criada_em > now() - ($2 || ' days')::interval`,
    janela
  )

  const { rows: s } = await getPool().query(
    `SELECT count(DISTINCT s.id)::int selecoes,
            count(i.*)::int enviados,
            count(*) FILTER (WHERE i.status = 'aprovado_comprador')::int aprovados,
            count(*) FILTER (WHERE i.status = 'recusado')::int recusados
     FROM selecoes s
     LEFT JOIN selecao_itens i ON i.selecao_id = s.id
     WHERE s.usuario_id = ANY($1)
       AND s.enviada_em IS NOT NULL
       AND s.criada_em > now() - ($2 || ' days')::interval`,
    janela
  )

  const { rows: motivos } = await getPool().query(
    `SELECT i.motivo_recusa motivo, count(*)::int n
     FROM selecao_itens i
     JOIN selecoes s ON s.id = i.selecao_id
     WHERE s.usuario_id = ANY($1)
       AND i.motivo_recusa IS NOT NULL
       AND s.criada_em > now() - ($2 || ' days')::interval
     GROUP BY i.motivo_recusa ORDER BY count(*) DESC`,
    janela
  )

  const total = b[0].total as number
  const selecoes = s[0].selecoes as number
  const enviados = s[0].enviados as number

  return {
    buscas: total,
    taxa_aproveitamento: total === 0 ? null : Math.round((b[0].com_envio / total) * 100),
    selecoes_enviadas: selecoes,
    imoveis_enviados: enviados,
    media_enviados_por_selecao:
      selecoes === 0 ? null : Math.round((enviados / selecoes) * 10) / 10,
    buscas_sem_alta: b[0].sem_alta,
    aprovados_comprador: s[0].aprovados,
    recusados: s[0].recusados,
    motivos,
  }
}

/**
 * O resultado comercial do período.
 *
 * "Influenciado" e "potencial" são os rótulos corretos e estão nos nomes dos
 * campos de propósito: a MORA não gera a venda, ela participa do caminho até
 * ela. Dizer "geramos" e o negócio cair destrói a confiança de uma vez.
 */
export async function comercial(
  usuarioIds: number[],
  mensalidade: number | null,
  comissaoPct: number,
  dias = DIAS
): Promise<Comercial> {
  const vazio: Comercial = {
    aprovacoes_comprador: 0,
    visitas: 0,
    visitas_realizadas: 0,
    propostas: 0,
    vendas: 0,
    vgv_influenciado: 0,
    comissao_potencial: 0,
    multiplo_retorno: null,
    custo_por_visita: null,
  }
  if (usuarioIds.length === 0) return vazio

  const janela = [usuarioIds, String(dias)]

  const { rows: ap } = await getPool().query(
    `SELECT count(*)::int n
     FROM selecao_itens i
     JOIN selecoes s ON s.id = i.selecao_id
     WHERE s.usuario_id = ANY($1)
       AND i.status = 'aprovado_comprador'
       AND s.criada_em > now() - ($2 || ' days')::interval`,
    janela
  )

  const { rows: v } = await getPool().query(
    `SELECT count(*)::int total,
            count(*) FILTER (WHERE status = 'realizada')::int realizadas
     FROM visitas
     WHERE usuario_id = ANY($1) AND criada_em > now() - ($2 || ' days')::interval`,
    janela
  )

  const { rows: n } = await getPool().query(
    `SELECT count(*)::int propostas,
            count(*) FILTER (WHERE status = 'ganho')::int vendas,
            coalesce(sum(valor) FILTER (WHERE status = 'ganho'), 0)::numeric vgv
     FROM negocios
     WHERE usuario_id = ANY($1) AND criado_em > now() - ($2 || ' days')::interval`,
    janela
  )

  const vgv = Number(n[0].vgv)
  const comissao = vgv * (comissaoPct / 100)
  const visitas = v[0].total as number

  return {
    aprovacoes_comprador: ap[0].n,
    visitas,
    visitas_realizadas: v[0].realizadas,
    propostas: n[0].propostas,
    vendas: n[0].vendas,
    vgv_influenciado: vgv,
    comissao_potencial: Math.round(comissao),
    // Sem mensalidade cadastrada não há divisor, e inventar um seria pior que
    // deixar o campo vazio.
    multiplo_retorno:
      mensalidade && mensalidade > 0 ? Math.round((comissao / mensalidade) * 10) / 10 : null,
    custo_por_visita:
      mensalidade && visitas > 0 ? Math.round(mensalidade / visitas) : null,
  }
}

/** Matriz de adoção por corretor — a visão do gerente comercial. */
export async function adocaoPorCorretor(contaId: number, dias = DIAS) {
  const { rows } = await getPool().query(
    `SELECT u.id, u.nome, u.papel,
            count(DISTINCT b.id)::int buscas,
            count(DISTINCT s.id) FILTER (WHERE s.enviada_em IS NOT NULL)::int selecoes,
            count(i.*) FILTER (WHERE i.status = 'aprovado_comprador')::int aprovados,
            max(b.criada_em) ultima_busca
     FROM usuarios u
     LEFT JOIN buscas b
       ON b.usuario_id = u.id AND b.criada_em > now() - ($2 || ' days')::interval
     LEFT JOIN selecoes s
       ON s.usuario_id = u.id AND s.criada_em > now() - ($2 || ' days')::interval
     LEFT JOIN selecao_itens i ON i.selecao_id = s.id
     WHERE u.conta_id = $1
     GROUP BY u.id, u.nome, u.papel
     ORDER BY count(DISTINCT b.id) DESC`,
    [contaId, String(dias)]
  )

  return rows.map((r) => ({
    ...r,
    // Taxa, não volume: o documento avisa que ranking por volume gera gaming e
    // desmotiva o meio da tabela.
    taxa_envio: r.buscas === 0 ? null : Math.round((r.selecoes / r.buscas) * 100),
  }))
}

/** Alertas acionáveis — não relatório. */
export async function alertas(usuarioIds: number[]) {
  if (usuarioIds.length === 0) return []

  const { rows } = await getPool().query(
    `SELECT s.token, s.cliente, s.enviada_em, s.aberturas,
            count(*) FILTER (WHERE i.status IN ('aprovado_comprador','recusado'))::int respondeu,
            sum(i.visualizacoes)::int visualizacoes
     FROM selecoes s
     JOIN selecao_itens i ON i.selecao_id = s.id
     WHERE s.usuario_id = ANY($1)
       AND s.enviada_em IS NOT NULL
       AND s.enviada_em < now() - interval '7 days'
     GROUP BY s.id
     HAVING count(*) FILTER (WHERE i.status IN ('aprovado_comprador','recusado')) = 0
     ORDER BY s.enviada_em ASC
     LIMIT 10`,
    [usuarioIds]
  )

  return rows.map((r) => ({
    token: r.token,
    cliente: r.cliente ?? 'cliente sem nome',
    dias: Math.floor((Date.now() - new Date(r.enviada_em).getTime()) / 86_400_000),
    aberturas: r.aberturas,
    visualizacoes: r.visualizacoes ?? 0,
  }))
}

/** Os ids de usuário que um painel deve agregar, conforme o papel de quem olha. */
export async function escopoDeUsuarios(
  usuario: { id: number; conta_id: number; papel: string }
): Promise<number[]> {
  // Corretor vê o seu. Gerente, diretor e iara veem a conta inteira.
  if (usuario.papel === 'corretor') return [usuario.id]

  const { rows } = await getPool().query(
    `SELECT id FROM usuarios WHERE conta_id = $1`,
    [usuario.conta_id]
  )
  return rows.map((r) => r.id)
}
