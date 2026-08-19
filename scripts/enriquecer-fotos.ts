import Anthropic from '@anthropic-ai/sdk'
import sharp from 'sharp'
import { getPool } from '../lib/db'

/**
 * Lê as FOTOS dos anúncios.
 *
 * O princípio do projeto é que toda extração de LLM carregue uma evidência
 * apontável e verificável mecanicamente. No texto isso é a citação literal,
 * conferida por substring. Numa foto não existe substring — o análogo é o
 * ÍNDICE DA FOTO: o modelo é obrigado a dizer em qual imagem viu cada coisa,
 * e a gente confere que aquele índice existe no anúncio. Na interface, o chip
 * abre exatamente a foto citada, então quem lê confere com um clique.
 *
 * O vocabulário é fechado e restrito ao que está em pixel. Nada de "silencioso"
 * ou "bem localizado" — isso não se vê numa imagem.
 */

const client = new Anthropic()
const MODELO = 'claude-opus-5'

const ATRIBUTOS = [
  'eh_render_3d',
  'planta_baixa',
  'imovel_vazio',
  'mobiliado_nas_fotos',
  'reforma_recente_aparente',
  'precisa_reforma_aparente',
  'armarios_embutidos',
  'piso_madeira_ou_laminado',
  'piso_ceramico_ou_porcelanato',
  'cozinha_integrada',
  'vista_livre_visivel',
  'vista_bloqueada_por_predio',
  'sem_foto_do_interior',
  'fotos_escuras_ou_ruins',
] as const

const TOOL = {
  name: 'registrar_visual',
  description: 'Registra o que as fotos do anúncio mostram, apontando a foto de cada item.',
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
            valor: { type: 'boolean' as const },
            foto_index: {
              type: 'integer' as const,
              description:
                'Índice da foto onde isto é visível, exatamente como numerado no prompt.',
            },
          },
          required: ['atributo', 'valor', 'foto_index'],
          additionalProperties: false,
        },
      },
    },
    required: ['atributos'],
    additionalProperties: false,
  },
}

const SYSTEM = `Você analisa fotos de anúncios de apartamento.

Regras absolutas:
- Registre apenas o que está VISÍVEL nos pixels. Nada de inferir localização,
  ruído, vizinhança, segurança ou qualidade de construção.
- Toda afirmação precisa apontar a foto onde ela é visível, pelo índice exato
  que aparece no prompt.
- "eh_render_3d" é para imagem gerada por computador (lançamento na planta),
  não foto de imóvel real: procure iluminação perfeita demais, ausência de
  desgaste, plantas e objetos artificiais, bordas limpas demais.
- "sem_foto_do_interior" só quando TODAS as fotos são fachada, área comum,
  piscina ou vista externa — nenhuma mostra cômodo do apartamento.
- Ausência de evidência não é negação. Se não dá para ver, não registre.
- Zero atributos é uma resposta válida e comum.`

const MAX_FOTOS = 8

async function baixarEReduzir(url: string): Promise<{ b64: string; tipo: string } | null> {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'mora.ai/1.0' } })
    if (!r.ok) return null
    const buf = Buffer.from(await r.arrayBuffer())
    // Reduzir é decisão de custo: em resolução plena a mesma pergunta custa
    // 3x mais tokens sem responder melhor "isto é um render?".
    const out = await sharp(buf).resize(1000, 1000, { fit: 'inside' }).jpeg({ quality: 78 }).toBuffer()
    return { b64: out.toString('base64'), tipo: 'image/jpeg' }
  } catch {
    return null
  }
}

async function main() {
  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT id, fotos FROM imoveis
     WHERE array_length(fotos, 1) >= 3
       AND id NOT IN (SELECT DISTINCT imovel_id FROM atributos_visuais)
     ORDER BY id
     LIMIT ${Number(process.argv[2] ?? 120)}`
  )

  console.log(`${rows.length} imóveis com fotos para analisar\n`)

  let gravados = 0
  let descartados = 0
  let semImagem = 0

  for (const [i, im] of rows.entries()) {
    const urls: string[] = im.fotos.slice(0, MAX_FOTOS)
    const blocos: Anthropic.ContentBlockParam[] = []
    const usadas: string[] = []

    for (const [idx, u] of urls.entries()) {
      const img = await baixarEReduzir(u)
      if (!img) continue
      blocos.push({ type: 'text', text: `foto ${usadas.length}:` })
      blocos.push({
        type: 'image',
        source: { type: 'base64', media_type: img.tipo as 'image/jpeg', data: img.b64 },
      })
      usadas.push(u)
    }

    if (usadas.length < 2) {
      semImagem++
      continue
    }

    try {
      const r = await client.messages.create({
        model: MODELO,
        max_tokens: 1500,
        output_config: { effort: 'low' },
        system: SYSTEM,
        tools: [TOOL as unknown as Anthropic.Tool],
        tool_choice: { type: 'tool', name: 'registrar_visual' },
        messages: [{ role: 'user', content: blocos }],
      })

      const bloco = r.content.find((b) => b.type === 'tool_use') as
        | Anthropic.ToolUseBlock
        | undefined
      const lista = (bloco?.input as { atributos?: any[] })?.atributos ?? []

      for (const a of lista) {
        // A verificação que sustenta o princípio: o índice tem que existir.
        // Modelo apontando foto que não existe é modelo inventando.
        if (
          !Number.isInteger(a.foto_index) ||
          a.foto_index < 0 ||
          a.foto_index >= usadas.length
        ) {
          descartados++
          continue
        }
        await pool.query(
          `INSERT INTO atributos_visuais
             (imovel_id, atributo, valor, foto_index, foto_url, modelo)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (imovel_id, atributo) DO NOTHING`,
          [im.id, a.atributo, a.valor, a.foto_index, usadas[a.foto_index], MODELO]
        )
        gravados++
      }
    } catch (e) {
      console.warn(`  imóvel ${im.id}: ${(e as Error).message.slice(0, 70)}`)
    }

    if ((i + 1) % 10 === 0) {
      console.log(`  ${i + 1}/${rows.length} · ${gravados} atributos · ${descartados} descartados`)
    }
  }

  console.log(
    `\n═══ ${gravados} atributos visuais | ${descartados} descartados por índice inválido | ` +
      `${semImagem} sem imagem acessível ═══`
  )
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
