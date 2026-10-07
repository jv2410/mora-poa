import '../tests/setup'
import { getPool } from '../lib/db'
import { hashSenha } from '../lib/auth'
import { criarSelecao, marcarEnviada, registrarBusca, responder, registrarAbertura } from '../lib/selecao'

/**
 * Popula uma conta de demonstração com um funil completo e coerente.
 *
 * Por que existe: o painel só tem sentido com histórico, e histórico leva
 * semanas de uso real para aparecer. Para apresentar o produto antes disso,
 * criamos uma conta com movimento — buscas, seleções, respostas de comprador,
 * visitas e negócios — toda ela plantada por este script.
 *
 * A conta é identificável pelo nome e pelo domínio de e-mail, e as linhas de
 * desfecho ficam com `origem = 'mora'`. Quando o conector de CRM existir, ele
 * grava nas mesmas tabelas com `origem = 'crm'`, e aí dá para separar o que
 * veio de onde com uma query.
 *
 * Idempotente: rodar de novo não duplica a conta.
 */

const CONTA = 'Imobiliária Vista Sul'

/**
 * Mensalidade de plano de imobiliária, não de autônomo. O valor entra no
 * múltiplo de retorno como divisor: com R$ 890 — que é preço de assinatura
 * individual — uma equipe de seis corretores produziria um múltiplo de três
 * dígitos, e um número desses não convence ninguém, ainda que a conta esteja
 * certa.
 */
const DOMINIO = 'vistasul.demo'

const CORRETORES = [
  { nome: 'Ana Paula Rocha', papel: 'corretor', peso: 1.0 },
  { nome: 'Márcio Beltrão', papel: 'corretor', peso: 0.65 },
  { nome: 'Juliana Prates', papel: 'corretor', peso: 0.8 },
  { nome: 'Rafael Nunes', papel: 'corretor', peso: 0.3 },
  { nome: 'Cláudia Reis', papel: 'gerente', peso: 0.4 },
]

const CLIENTES = [
  'Casal Menezes', 'Dr. Fernando', 'Família Okamoto', 'Patrícia e Lucas',
  'Sr. Albuquerque', 'Renata Dias', 'Casal Tavares', 'Igor Mendonça',
  'Dona Marlene', 'Vinícius e Bruna', 'Família Schmitt', 'Tereza Lacerda',
]

const BRIEFINGS = [
  { texto: 'Casal com bebê a caminho, querem sair do aluguel no Menino Deus. 3 dorm, 1 suíte, 2 vagas. Teto de 750, estica até 800 se for muito bom.',
    c: { dorm_min: 3, vagas_min: 2, preco_max: 750_000, bairros: ['Menino Deus'] } },
  { texto: 'Investidor procurando 2 dorm para alugar perto da PUC. Até 450, condomínio baixo é essencial.',
    c: { dorm_min: 2, preco_max: 450_000, custo_mensal_max: 700, bairros: ['Partenon'] } },
  { texto: 'Aposentado vendendo casa grande, quer apartamento térreo ou com elevador no Petrópolis. Até 600.',
    c: { dorm_min: 2, preco_max: 600_000, bairros: ['Petrópolis'] } },
  { texto: 'Família com dois adolescentes, precisam de 3 dormitórios e 2 vagas no Bela Vista ou Moinhos. Até 1,2 milhão.',
    c: { dorm_min: 3, vagas_min: 2, preco_max: 1_200_000, bairros: ['Bela Vista', 'Moinhos de Vento'] } },
  { texto: 'Primeiro imóvel, orçamento apertado. 2 dorm até 320 mil, aceita qualquer zona com transporte.',
    c: { dorm_min: 2, preco_max: 320_000 } },
  { texto: 'Médica recém-formada, quer 1 dorm moderno na Cidade Baixa ou Bom Fim, até 400.',
    c: { dorm_min: 1, preco_max: 400_000, bairros: ['Cidade Baixa', 'Bom Fim'] } },
  { texto: 'Casal sem filhos procurando cobertura. Até 1,5 milhão, precisa de 2 vagas cobertas.',
    c: { dorm_min: 2, vagas_min: 2, preco_max: 1_500_000 } },
  { texto: 'Cliente quer 4 dormitórios no Moinhos de Vento até 900 mil. Sei que é difícil.',
    c: { dorm_min: 4, preco_max: 900_000, bairros: ['Moinhos de Vento'] } },
]

const MOTIVOS = ['preco', 'localizacao', 'andar', 'tamanho'] as const

/** Determinístico: a demo precisa ser a mesma toda vez que for apresentada. */
let semente = 42
function aleatorio(): number {
  semente = (semente * 1103515245 + 12345) % 2147483648
  return semente / 2147483648
}
const escolher = <T,>(lista: readonly T[]): T => lista[Math.floor(aleatorio() * lista.length)]
const entre = (a: number, b: number) => a + Math.floor(aleatorio() * (b - a + 1))

async function main() {
  const pool = getPool()

  const { rows: existente } = await pool.query(`SELECT id FROM contas WHERE nome = $1`, [CONTA])
  if (existente[0]) {
    console.log(`A conta "${CONTA}" já existe (id ${existente[0].id}). Nada a fazer.`)
    console.log(`Entre com diretoria@${DOMINIO} / demo12345`)
    return
  }

  const { rows: conta } = await pool.query(
    `INSERT INTO contas (nome, comissao_pct, mensalidade, min_por_30_imoveis)
     VALUES ($1, 5.0, 3900, 8) RETURNING id`,
    [CONTA]
  )
  const contaId = conta[0].id
  const senha = await hashSenha('demo12345')

  const { rows: diretor } = await pool.query(
    `INSERT INTO usuarios (conta_id, nome, email, senha_hash, papel)
     VALUES ($1, 'Helena Vasques', $2, $3, 'diretor') RETURNING id`,
    [contaId, `diretoria@${DOMINIO}`, senha]
  )

  const equipe: Array<{ id: number; peso: number }> = []
  for (const c of CORRETORES) {
    const email = `${c.nome.split(' ')[0].toLowerCase()}@${DOMINIO}`
    const { rows } = await pool.query(
      `INSERT INTO usuarios (conta_id, nome, email, senha_hash, papel)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [contaId, c.nome, email, senha, c.papel]
    )
    equipe.push({ id: rows[0].id, peso: c.peso })
  }

  // Imóveis bons o bastante para montar seleções com cara de real.
  const { rows: imoveis } = await pool.query(
    `SELECT id, preco FROM imoveis
     WHERE qualidade_cadastro >= 70 AND preco BETWEEN 200000 AND 1500000
     ORDER BY id LIMIT 120`
  )
  if (imoveis.length < 20) throw new Error('Estoque insuficiente para semear a demo.')

  let nBuscas = 0, nSelecoes = 0, nVisitas = 0, nNegocios = 0

  for (const membro of equipe) {
    const quantas = Math.round(14 * membro.peso)

    for (let i = 0; i < quantas; i++) {
      const brief = escolher(BRIEFINGS)
      const alta = aleatorio() < 0.78 ? entre(2, 7) : 0
      const vale = entre(1, 6)

      const buscaId = await registrarBusca({
        corretorId: null,
        usuarioId: membro.id,
        briefing: brief.texto,
        criterios: brief.c,
        alta,
        valeApresentar: vale,
      })

      // Espalha as buscas pelos últimos 30 dias.
      const diasAtras = entre(0, 29)
      if (buscaId) {
        await pool.query(
          `UPDATE buscas SET criada_em = now() - ($2 || ' days')::interval WHERE id = $1`,
          [buscaId, String(diasAtras)]
        )
        nBuscas++
      }

      // Nem toda busca vira seleção — é isso que dá sentido à taxa de
      // aproveitamento. Busca sem alta compatibilidade raramente vira.
      const vira = alta > 0 ? aleatorio() < 0.72 : aleatorio() < 0.15
      if (!vira) continue

      const quantosItens = entre(3, 6)
      const escolhidos = new Set<number>()
      while (escolhidos.size < quantosItens) {
        escolhidos.add(imoveis[Math.floor(aleatorio() * imoveis.length)].id)
      }

      const itens = [...escolhidos].map((id, idx) => ({
        imovel_id: id,
        faixa: (idx < Math.min(alta, quantosItens - 1) ? 'alta' : 'ressalva') as 'alta' | 'ressalva',
        ressalva:
          idx < Math.min(alta, quantosItens - 1)
            ? null
            : escolher([
                'Atende tudo, exceto o teto de preço — R$ 40 mil acima',
                'Atende tudo, exceto as vagas — tem 1, pediram 2',
                'Atende tudo, exceto os dormitórios — tem 2, pediram 3',
                'Atende tudo, exceto o custo mensal — R$ 180 acima do teto',
              ]),
      }))

      const cliente = escolher(CLIENTES)
      const token = await criarSelecao({
        corretorId: `demo-${membro.id}`,
        usuarioId: membro.id,
        buscaId,
        cliente,
        itens,
      })
      await marcarEnviada(token)

      const { rows: sel } = await pool.query(`SELECT id FROM selecoes WHERE token = $1`, [token])
      const selecaoId = sel[0].id
      await pool.query(
        `UPDATE selecoes SET criada_em = now() - ($2 || ' days')::interval,
                             enviada_em = now() - ($2 || ' days')::interval
         WHERE id = $1`,
        [selecaoId, String(diasAtras)]
      )
      nSelecoes++

      // O comprador abre, às vezes mais de uma vez.
      const abriu = aleatorio() < 0.84
      if (!abriu) continue
      for (let a = 0; a < entre(1, 4); a++) await registrarAbertura(token)

      // E responde a alguns imóveis.
      for (const it of itens) {
        const r = aleatorio()
        if (r < 0.26) {
          await responder(token, it.imovel_id, 'quero_visitar')

          // Aprovou: parte vira visita agendada.
          if (aleatorio() < 0.72) {
            const realizada = aleatorio() < 0.74
            await pool.query(
              `INSERT INTO visitas
                 (usuario_id, selecao_id, imovel_id, cliente, status, agendada_para, criada_em)
               VALUES ($1,$2,$3,$4,$5, now() - ($6 || ' days')::interval,
                       now() - ($6 || ' days')::interval)`,
              [
                membro.id, selecaoId, it.imovel_id, cliente,
                realizada ? 'realizada' : 'agendada',
                String(Math.max(0, diasAtras - entre(1, 4))),
              ]
            )
            nVisitas++

            // Visita realizada às vezes vira proposta, e proposta às vezes
            // vira venda. As taxas aqui são o que dá realismo ao funil.
            if (realizada && aleatorio() < 0.3) {
              const { rows: im } = await pool.query(
                `SELECT preco FROM imoveis WHERE id = $1`, [it.imovel_id]
              )
              const anunciado = Number(im[0].preco)
              // Fecha abaixo do anunciado: proposta é negociação.
              const valor = Math.round(anunciado * (0.93 + aleatorio() * 0.06))
              const ganho = aleatorio() < 0.45
              await pool.query(
                `INSERT INTO negocios
                   (usuario_id, imovel_id, selecao_id, cliente, valor, status,
                    criado_em, fechado_em)
                 VALUES ($1,$2,$3,$4,$5,$6,
                         now() - ($7 || ' days')::interval,
                         CASE WHEN $6 = 'ganho'
                              THEN now() - ($7 || ' days')::interval END)`,
                [
                  membro.id, it.imovel_id, selecaoId, cliente, valor,
                  ganho ? 'ganho' : 'proposta',
                  String(Math.max(0, diasAtras - entre(2, 6))),
                ]
              )
              nNegocios++
            }
          }
        } else if (r < 0.46) {
          await responder(token, it.imovel_id, 'nao_e_pra_mim', escolher(MOTIVOS))
        }
      }
    }
  }

  console.log(`Conta "${CONTA}" criada (id ${contaId}).`)
  console.log(`  ${equipe.length + 1} usuários · ${nBuscas} buscas · ${nSelecoes} seleções`)
  console.log(`  ${nVisitas} visitas · ${nNegocios} negócios`)
  console.log(`\nEntrar como diretoria: diretoria@${DOMINIO} / demo12345`)
  console.log(`Entrar como corretora:  ana@${DOMINIO} / demo12345`)
  console.log(`Entrar como gerente:    cláudia@${DOMINIO} / demo12345`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
