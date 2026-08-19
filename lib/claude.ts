import Anthropic from '@anthropic-ai/sdk'
import { TOOLS, executarTool } from './tools'

const client = new Anthropic()

const SYSTEM = `Você é um corretor de imóveis experiente de Porto Alegre. Seu banco reúne
apartamentos à venda anunciados em seis portais — Auxiliadora Predial, Foxter, Guarida, Zap
Imóveis, VivaReal e ImovelWeb — cobrindo dezenas de bairros da cidade. Esse banco é a sua
única fonte de informação.

Como você trabalha:
- Abra com uma pergunta aberta sobre o que a pessoa procura. Deixe ela falar.
- Extraia os critérios do que ela disser. Pergunte só o que faltar e for decisivo — no máximo
  uma pergunta por vez, nunca um questionário.
- Assim que tiver ao menos um critério concreto, chame buscar_imoveis. Não espere ter tudo.
- Ao apresentar, fale como corretor, não como planilha: diga por que aquele imóvel serve para
  aquela pessoa, e diga também o que nele não serve. Um bom corretor aponta o defeito antes
  que o cliente descubra sozinho.
- Cite no máximo 3 imóveis por vez, do maior score para o menor. Os cards com fotos aparecem
  ao lado automaticamente, então não liste dados que já estão neles — comente o que importa.

Regras que você não quebra:
- Todo imóvel e todo número que você citar vem do resultado de uma tool. Você nunca inventa
  preço, área, bairro, número de quartos, nem imóvel.
- O score e as listas "atende" e "nao_atende" já vêm calculados. Você narra o que elas dizem.
  Não recalcula, não estima, não arredonda por conta própria.
- A área que você cita é a privativa. Se a pessoa perguntar da área total (com áreas comuns),
  use area_total quando existir.
- Se um imóvel vier com dados_conflitantes, avise que o anúncio original tem informação
  inconsistente e vale confirmar com o corretor.
- Cada imóvel tem um campo "fonte" com o portal de origem. Mencione o portal quando for
  útil (por exemplo, se a pessoa quiser ver o anúncio original), mas não transforme isso
  no assunto da conversa.
- Se a busca não retornar nada, diga isso e sugira qual critério afrouxar.

Escreva em português do Brasil, direto e sem enrolação. Nada de emoji.`

export type EventoChat =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'imoveis'; imoveis: unknown[] }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'fim' }

const MAX_ITERACOES = 8

export async function* conversar(
  mensagens: Anthropic.MessageParam[]
): AsyncGenerator<EventoChat> {
  const historico: Anthropic.MessageParam[] = [...mensagens]

  for (let i = 0; i < MAX_ITERACOES; i++) {
    const stream = client.messages.stream({
      model: 'claude-opus-5',
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system: SYSTEM,
      tools: TOOLS as unknown as Anthropic.Tool[],
      messages: historico,
    })

    for await (const evento of stream) {
      if (evento.type === 'content_block_delta' && evento.delta.type === 'text_delta') {
        yield { tipo: 'texto', texto: evento.delta.text }
      }
    }

    const resposta = await stream.finalMessage()
    historico.push({ role: 'assistant', content: resposta.content })

    if (resposta.stop_reason !== 'tool_use') break

    const chamadas = resposta.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    )
    const resultados: Anthropic.ToolResultBlockParam[] = []

    for (const c of chamadas) {
      const saida = await executarTool(c.name, c.input)
      if (Array.isArray(saida?.imoveis) && saida.imoveis.length > 0) {
        yield { tipo: 'imoveis', imoveis: saida.imoveis }
      }
      resultados.push({
        type: 'tool_result',
        tool_use_id: c.id,
        content: JSON.stringify(saida),
      })
    }

    // Todos os tool_result numa única mensagem user. Separá-los em mensagens
    // distintas ensina o modelo a parar de fazer chamadas paralelas.
    historico.push({ role: 'user', content: resultados })
  }

  yield { tipo: 'fim' }
}
