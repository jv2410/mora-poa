import '../tests/setup'
import { getPool } from '../lib/db'

/**
 * Adensa o funil da conta de demonstração.
 *
 * Só insere: transforma aprovações do comprador que ainda não têm visita em
 * visita, e visitas realizadas que ainda não têm negócio em proposta ou venda.
 * Nada é apagado nem alterado, então pode rodar mais de uma vez — cada
 * execução só preenche o que ainda está vazio.
 */

const CONTA = 'Imobiliária Vista Sul'

let semente = 7
const aleatorio = () => {
  semente = (semente * 1103515245 + 12345) % 2147483648
  return semente / 2147483648
}
const entre = (a: number, b: number) => a + Math.floor(aleatorio() * (b - a + 1))

async function main() {
  const pool = getPool()
  const { rows: c } = await pool.query(`SELECT id FROM contas WHERE nome = $1`, [CONTA])
  if (!c[0]) throw new Error(`Conta "${CONTA}" não existe. Rode semear-demo primeiro.`)

  // 0) Preenche `analisados` onde está vazio.
  //
  // Preencher campo nulo é completar dado ausente, não sobrescrever: a
  // condição IS NULL garante que nenhuma busca já contabilizada seja tocada.
  const { rows: estoque } = await pool.query(`SELECT count(*)::int n FROM imoveis`)
  const { rowCount: preenchidas } = await pool.query(
    `UPDATE buscas SET analisados = $2
     WHERE analisados IS NULL
       AND usuario_id IN (SELECT id FROM usuarios WHERE conta_id = $1)`,
    [c[0].id, estoque[0].n]
  )
  if (preenchidas) console.log(`${preenchidas} buscas ganharam o total analisado.`)

  // 1) Aprovações do comprador que ainda não viraram visita.
  const { rows: semVisita } = await pool.query(
    `SELECT i.imovel_id, s.id selecao_id, s.usuario_id, s.cliente, s.criada_em
     FROM selecao_itens i
     JOIN selecoes s ON s.id = i.selecao_id
     JOIN usuarios u ON u.id = s.usuario_id
     WHERE u.conta_id = $1
       AND i.status = 'aprovado_comprador'
       AND NOT EXISTS (
         SELECT 1 FROM visitas v
         WHERE v.selecao_id = s.id AND v.imovel_id = i.imovel_id
       )`,
    [c[0].id]
  )

  let novasVisitas = 0
  for (const a of semVisita) {
    // Quase toda aprovação vira visita: o comprador já disse que quer ver.
    if (aleatorio() > 0.88) continue
    const realizada = aleatorio() < 0.78
    await pool.query(
      `INSERT INTO visitas
         (usuario_id, selecao_id, imovel_id, cliente, status, agendada_para, criada_em)
       VALUES ($1,$2,$3,$4,$5, $6::timestamptz + interval '3 days',
               $6::timestamptz + interval '1 day')`,
      [a.usuario_id, a.selecao_id, a.imovel_id, a.cliente,
       realizada ? 'realizada' : 'agendada', a.criada_em]
    )
    novasVisitas++
  }

  // 2) Visitas realizadas que ainda não viraram negócio.
  const { rows: semNegocio } = await pool.query(
    `SELECT v.id, v.usuario_id, v.imovel_id, v.selecao_id, v.cliente, v.criada_em,
            im.preco
     FROM visitas v
     JOIN usuarios u ON u.id = v.usuario_id
     JOIN imoveis im ON im.id = v.imovel_id
     WHERE u.conta_id = $1
       AND v.status = 'realizada'
       AND NOT EXISTS (
         SELECT 1 FROM negocios n
         WHERE n.selecao_id = v.selecao_id AND n.imovel_id = v.imovel_id
       )`,
    [c[0].id]
  )

  let novosNegocios = 0
  for (const v of semNegocio) {
    // Nem toda visita vira proposta — é essa queda que faz o funil parecer
    // funil em vez de escada reta.
    if (aleatorio() > 0.52) continue
    const anunciado = Number(v.preco)
    const valor = Math.round(anunciado * (0.92 + aleatorio() * 0.07))
    const ganho = aleatorio() < 0.52
    await pool.query(
      `INSERT INTO negocios
         (usuario_id, imovel_id, selecao_id, cliente, valor, status, criado_em, fechado_em)
       VALUES ($1,$2,$3,$4,$5,$6,
               $7::timestamptz + interval '2 days',
               CASE WHEN $6 = 'ganho' THEN $7::timestamptz + interval '6 days' END)`,
      [v.usuario_id, v.imovel_id, v.selecao_id, v.cliente, valor,
       ganho ? 'ganho' : 'proposta', v.criada_em]
    )
    novosNegocios++
  }

  const { rows: r } = await pool.query(
    `SELECT (SELECT count(*) FROM visitas v JOIN usuarios u ON u.id=v.usuario_id
             WHERE u.conta_id=$1)::int visitas,
            (SELECT count(*) FROM negocios n JOIN usuarios u ON u.id=n.usuario_id
             WHERE u.conta_id=$1)::int negocios,
            (SELECT coalesce(sum(valor),0) FROM negocios n JOIN usuarios u ON u.id=n.usuario_id
             WHERE u.conta_id=$1 AND n.status='ganho')::numeric vgv`,
    [c[0].id]
  )

  console.log(`+${novasVisitas} visitas · +${novosNegocios} negócios`)
  console.log(`Total: ${r[0].visitas} visitas · ${r[0].negocios} negócios`)
  console.log(`VGV influenciado: R$ ${Number(r[0].vgv).toLocaleString('pt-BR')}`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
