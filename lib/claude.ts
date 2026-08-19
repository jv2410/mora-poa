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

O que te separa de um filtro de busca:
- Preço sem contexto não diz nada. Ao destacar um imóvel, chame contexto_mercado e diga
  onde ele cai entre os comparáveis: "R$ 8.200 o m², contra mediana de R$ 9.400 no
  Petrópolis para 2 dormitórios, numa amostra de 14 anúncios". Se a amostra for pequena,
  diga isso em vez de fingir conclusão.
- Ninguém no Brasil avisa o comprador sobre ITBI e cartório antes da véspera da escritura.
  Se a pessoa mencionar entrada, financiamento, parcela ou renda, chame simular_compra e
  mostre o dinheiro que ela precisa ter no dia da assinatura — não só a entrada.
- Quando um imóvel parecer barato demais para o bairro, desconfie em voz alta e sugira o
  que investigar. Preço bom sem motivo aparente costuma ter motivo.
- Se a pessoa não souber onde procurar, ou perguntar onde é mais barato, onde vale a pena,
  ou quanto custa o m² em algum lugar, chame raio_x_bairros e situe o orçamento dela no
  mapa da cidade: com o dinheiro que ela tem, quais bairros cabem e o que ela troca ao
  escolher cada um.

- O anúncio que esconde informação não é neutro: quando detalhar_imovel devolver
  leve_para_a_visita, use esses pontos. Dizer "o anúncio não informa o condomínio, peça o
  boleto" vale mais para quem vai comprar do que qualquer elogio ao imóvel.
- Preço de etiqueta engana. Se o imóvel tiver custo_10_anos, lembre que condomínio e IPTU
  ao longo de dez anos costumam mudar a ordem do que é barato.

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
  | { tipo: 'status'; tool: string; detalhe: string }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'fim' }

const brl = (n: number) =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

/**
 * Traduz a chamada de tool para uma frase de gente, com os critérios reais.
 *
 * Isso não é um spinner enfeitado: durante os 20 segundos de espera, é a prova
 * visível de que os números vêm de uma consulta ao banco e não da cabeça do
 * modelo. O item de confiança e o de loading resolvidos pela mesma frase.
 */
function narrarTool(nome: string, input: any): string {
  switch (nome) {
    case 'buscar_imoveis': {
      const p: string[] = []
      if (input?.dorm_min) p.push(`${input.dorm_min} quartos`)
      if (input?.vagas_min) p.push(`${input.vagas_min} vaga${input.vagas_min > 1 ? 's' : ''}`)
      if (input?.area_min) p.push(`a partir de ${input.area_min} m²`)
      if (input?.preco_max) p.push(`até ${brl(input.preco_max)}`)
      if (input?.bairros?.length) p.push(`em ${input.bairros.slice(0, 3).join(', ')}`)
      return p.length ? `buscando ${p.join(', ')}…` : 'buscando no banco…'
    }
    case 'contexto_mercado':
      return 'comparando com os imóveis semelhantes do bairro…'
    case 'simular_compra':
      return 'calculando ITBI, cartório e parcela…'
    case 'comparar_imoveis':
      return 'montando a comparação lado a lado…'
    case 'raio_x_bairros':
      return 'levantando o preço do m² em cada bairro…'
    case 'o_que_compra':
      return 'vendo o que esse orçamento compra em cada bairro…'
    case 'detalhar_imovel':
      return 'abrindo a ficha completa…'
    default:
      return 'consultando o banco…'
  }
}

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
      // O trabalho difícil está nas tools, que são determinísticas — o modelo
      // só narra o resultado. Effort baixo corta latência e custo sem tocar na
      // qualidade do que importa.
      output_config: { effort: 'low' },
      // tools e system são renderizados antes das messages e formam um prefixo
      // estável: cacheá-lo derruba o custo de input de toda conversa longa.
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
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
      yield { tipo: 'status', tool: c.name, detalhe: narrarTool(c.name, c.input) }
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
