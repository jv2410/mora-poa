import Anthropic from '@anthropic-ai/sdk'
import { getPool } from '../lib/db'

/**
 * Lê as descrições em texto livre e extrai atributos estruturados que nenhum
 * campo do portal carrega: aceita pet, sol da manhã, vista livre, andar alto,
 * reformado, mobiliado, sem elevador.
 *
 * Cada atributo vem com a CITAÇÃO LITERAL que o comprova, e a citação é
 * validada por substring contra o texto original antes de ir para o banco.
 * Se o modelo escrever uma evidência que não existe no anúncio, o atributo é
 * descartado — o princípio "o modelo não inventa" deixa de ser confiança e
 * vira verificação.
 */

const client = new Anthropic()

const ATRIBUTOS = [
  'aceita_pet',
  'mobiliado',
  'reformado',
  'vista_livre',
  'sol_da_manha',
  'andar_alto',
  'tem_elevador',
  'sem_elevador',
  'sacada',
  'churrasqueira',
  'portaria_24h',
  'piscina',
  'academia',
  'quarto_de_servico',
  'aceita_financiamento',
  'aceita_permuta',
  'proximo_metro',
  'proximo_parque',
  'silencioso',
  'precisa_reforma',
] as const

const TOOL = {
  name: 'registrar_atributos',
  description:
    'Registra os atributos que a descrição do anúncio comprova, cada um com a ' +
    'citação literal do trecho que o comprova.',
  strict: true,
  input_schema: {
    type: 'object' as const,
    properties: {
      atributos: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            atributo: { type: 'string' as const, enum: ATRIBUTOS as unknown as string[] },
            valor: {
              type: 'boolean' as const,
              description: 'true se a descrição afirma o atributo, false se o nega',
            },
            evidencia: {
              type: 'string' as const,
              description:
                'Trecho COPIADO LITERALMENTE da descrição, palavra por palavra, ' +
                'que comprova o atributo. Máximo 140 caracteres. Nunca parafraseie.',
            },
          },
          required: ['atributo', 'valor', 'evidencia'],
          additionalProperties: false,
        },
      },
    },
    required: ['atributos'],
    additionalProperties: false,
  },
}

const SYSTEM = `Você extrai atributos de anúncios imobiliários.

Regras absolutas:
- Só registre um atributo se a descrição o afirmar ou negar EXPLICITAMENTE.
- A evidência precisa ser um trecho copiado LITERALMENTE do texto, caractere por
  caractere. Não parafraseie, não corrija, não normalize. Se você não consegue
  copiar um trecho literal que comprove, não registre o atributo.
- Ausência de menção não é negação. Um anúncio que não fala de pet não vira
  aceita_pet=false — simplesmente não registre.
- Registre no máximo os atributos que o texto realmente sustenta. Zero atributos
  é uma resposta válida e comum.`

/** Normaliza para comparar: caixa, acento e espaço não devem reprovar uma citação boa. */
function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

async function main() {
  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT id, descricao FROM imoveis
     WHERE descricao IS NOT NULL AND length(descricao) > 80
       AND id NOT IN (SELECT DISTINCT imovel_id FROM atributos_extraidos)
     ORDER BY id`
  )

  console.log(`${rows.length} descrições para processar\n`)

  let gravados = 0
  let descartados = 0
  let semAtributo = 0

  for (const [i, im] of rows.entries()) {
    try {
      const r = await client.messages.create({
        model: 'claude-opus-5',
        max_tokens: 2000,
        output_config: { effort: 'low' },
        system: SYSTEM,
        tools: [TOOL as unknown as Anthropic.Tool],
        tool_choice: { type: 'tool', name: 'registrar_atributos' },
        messages: [
          { role: 'user', content: `Descrição do anúncio:\n\n"""\n${im.descricao}\n"""` },
        ],
      })

      const bloco = r.content.find((b) => b.type === 'tool_use') as
        | Anthropic.ToolUseBlock
        | undefined
      const lista = (bloco?.input as { atributos?: unknown[] })?.atributos ?? []

      if (lista.length === 0) semAtributo++

      const alvo = normalizar(im.descricao)

      for (const a of lista as { atributo: string; valor: boolean; evidencia: string }[]) {
        // A verificação que sustenta o princípio: a citação tem que existir
        // mesmo no texto. Se não existe, o modelo produziu — e a gente descarta.
        if (!alvo.includes(normalizar(a.evidencia))) {
          descartados++
          continue
        }
        await pool.query(
          `INSERT INTO atributos_extraidos (imovel_id, atributo, valor, evidencia)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (imovel_id, atributo) DO NOTHING`,
          [im.id, a.atributo, a.valor, a.evidencia.slice(0, 300)]
        )
        gravados++
      }
    } catch (e) {
      console.warn(`  imóvel ${im.id}: ${(e as Error).message.slice(0, 70)}`)
    }

    if ((i + 1) % 25 === 0) {
      console.log(`  ${i + 1}/${rows.length} · ${gravados} atributos · ${descartados} descartados`)
    }
  }

  console.log(
    `\n═══ ${gravados} atributos gravados | ${descartados} descartados por citação inválida | ` +
      `${semAtributo} anúncios sem atributo extraível ═══`
  )
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
