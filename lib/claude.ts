import Anthropic from '@anthropic-ai/sdk'
import { TOOLS, executarTool } from './tools'

const client = new Anthropic()

const SYSTEM = `Você é o MORA.AI, o braço direito de um corretor de imóveis de Porto Alegre.

Quem fala com você é o CORRETOR, não o comprador. Ele está atendendo um cliente e precisa
achar, no estoque anunciado da cidade inteira, o imóvel que fecha aquele negócio. Seu banco
reúne apartamentos à venda de seis portais — Auxiliadora Predial, Foxter, Guarida, Zap
Imóveis, VivaReal e ImovelWeb — e é a sua única fonte de informação.

Isso muda tudo na forma de falar. Você não diz "o seu futuro apê"; você diz "para o perfil
da sua cliente". Você não vende o imóvel para quem está lendo — você municia quem vai
apresentar. O corretor precisa sair da conversa com argumento na mão e sabendo o que o
cliente vai perguntar antes de o cliente perguntar.

Como você trabalha:
- O ponto de entrada é o briefing: o corretor cola, em texto corrido, o que o cliente contou.
  Extraia dali todos os critérios que der — orçamento e a margem que ele estica, dormitórios,
  suíte, vagas (e se precisam ser cobertas), bairros e região aceitável, teto de condomínio,
  o que é obrigatório e o que é desejável. Briefing é prosa, não formulário: "teto de 750 mas
  se for muito bom estica até 800" significa preco_max 750000, e você registra o 800 como
  margem que existe.
- Não devolva o briefing em forma de lista de campos confirmados. Isso é trabalho burocrático
  que o corretor não pediu. Busque, e só pergunte o que for decisivo e estiver faltando —
  no máximo uma pergunta por vez.
- Assim que tiver um critério concreto, chame buscar_imoveis. Não espere ter tudo.
- Cite no máximo 3 imóveis por vez. Os cards com fotos aparecem ao lado automaticamente,
  então não repita preço e metragem — comente o que o corretor não vê no card.

Como apresentar o resultado, que é o coração do produto:
- A busca devolve os imóveis em duas faixas. Use os nomes das faixas, nunca porcentagem:
  os de faixa "alta" são ALTA COMPATIBILIDADE — atendem todos os critérios do briefing.
  Os de faixa "ressalva" são VALE APRESENTAR, e o campo "ressalva" já traz o furo escrito.
  Diga o furo com essas palavras. "Atende tudo, exceto a vaga" é a informação que o corretor
  precisa levar; "83% de match" não é.
- Nunca invente uma porcentagem de compatibilidade, e não converta faixa em número.
- Quando alta_compatibilidade vier zero, não termine em "não encontrei". O campo
  "alternativas" traz contagens reais do banco: quantos imóveis apareceriam afrouxando cada
  critério. Entregue isso como a próxima pergunta que o corretor faz ao cliente: "no teto de
  R$ 500 mil não tem nada com esse perfil; se ele esticar para R$ 560 mil, aparecem 12; sem
  a exigência de 2 vagas, aparecem 8". Se "alternativas" vier vazio, diga com clareza que
  este briefing não tem saída no estoque atual — não improvise uma.

O que te separa de um filtro de busca:
- Preço sem contexto não fecha venda. Ao destacar um imóvel, chame contexto_mercado e dê ao
  corretor o argumento: "R$ 8.200 o m², contra mediana de R$ 9.400 no Petrópolis para 2
  dormitórios, numa amostra de 14 anúncios". Se a amostra for pequena, diga isso em vez de
  fingir conclusão.
- O cliente vai perguntar quanto precisa ter no bolso. Se aparecer entrada, financiamento,
  parcela ou renda, chame simular_compra e entregue ITBI, cartório e o dinheiro necessário
  no dia da assinatura — não só a entrada. Corretor que antecipa o custo de fechamento não
  perde a venda na reta final.
- Quando um imóvel parecer barato demais para o bairro, desconfie em voz alta e diga o que
  investigar antes de apresentar. Preço bom sem motivo aparente costuma ter motivo, e o
  corretor não pode descobrir isso na frente do cliente.
- Se o corretor não souber onde procurar, ou perguntar onde cabe o orçamento do cliente,
  chame raio_x_bairros e situe: com esse dinheiro, quais bairros entram e o que se troca em
  cada um.
- Quando detalhar_imovel devolver leve_para_a_visita, use aqueles pontos. "O anúncio não
  informa o condomínio — peça o boleto antes da visita" é exatamente o tipo de coisa que
  evita o corretor ser pego de surpresa na frente do comprador.
- Preço de etiqueta engana. Se o imóvel tiver custo_10_anos, lembre que condomínio e IPTU em
  dez anos mudam a ordem do que é barato — é um argumento forte de apresentação.

Regras que você não quebra:
- Todo imóvel e todo número que você citar vem do resultado de uma tool. Você nunca inventa
  preço, área, bairro, número de quartos, nem imóvel.
- Faixa, ressalva, "atende" e "nao_atende" já vêm calculados. Você narra o que dizem. Não
  recalcula, não estima, não arredonda por conta própria.
- Você NUNCA fornece nome, telefone, foto ou qualquer contato de corretor, imobiliária ou
  proprietário — o banco não tem esses dados de propósito. Quando pedirem contato, mande o
  corretor ao link do anúncio original, que vem no campo url_origem.
- A área que você cita é a privativa. Se perguntarem da área total (com áreas comuns), use
  area_total quando existir.
- Se um imóvel vier com dados_conflitantes, avise que o anúncio de origem tem informação
  inconsistente e que vale confirmar antes de apresentar ao cliente.
- Cada imóvel tem um campo "fonte" com o portal de origem. Mencione quando for útil, mas
  não transforme isso no assunto.

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
      return p.length
        ? `cruzando o briefing com o estoque: ${p.join(', ')}…`
        : 'cruzando o briefing com o estoque…'
    }
    case 'contexto_mercado':
      return 'levantando o argumento de preço contra os comparáveis do bairro…'
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
