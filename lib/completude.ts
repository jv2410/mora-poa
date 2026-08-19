import type { Imovel } from './tipos'
import type { ContextoMercado } from './mercado'

export type Sinal = {
  tipo: string
  detalhe: string
  pergunta: string
}

/**
 * O que o anúncio não conta.
 *
 * Em vez de somar pontos num número mágico, devolve a lista de sinais
 * nomeados, cada um com o dado que o disparou e a pergunta que ele gera para
 * a visita. É o mesmo contrato dos atributos extraídos: nada de veredito
 * opaco, tudo apontável.
 *
 * O LLM narra esta lista; não a produz. Ausência de informação é o material
 * de negociação mais subestimado numa compra de imóvel.
 */
export function sinaisIncompletos(im: Imovel, ctx?: ContextoMercado | null): Sinal[] {
  const s: Sinal[] = []

  if (im.condominio == null) {
    s.push({
      tipo: 'sem_condominio',
      detalhe: 'o anúncio não informa o valor do condomínio',
      pergunta:
        'Qual é o condomínio e o que ele inclui? Peça o boleto dos últimos três meses.',
    })
  }

  if (im.iptu == null) {
    s.push({
      tipo: 'sem_iptu',
      detalhe: 'o anúncio não informa o IPTU',
      pergunta: 'Qual o valor do IPTU do ano e se há parcelamento em aberto.',
    })
  }

  if (!im.endereco) {
    s.push({
      tipo: 'sem_endereco',
      detalhe: 'o anúncio não diz a rua, só o bairro',
      pergunta:
        'Qual o endereço exato? Bairro grande esconde diferenças enormes de rua para rua.',
    })
  }

  const nFotos = im.fotos?.length ?? 0
  if (nFotos === 0) {
    s.push({
      tipo: 'sem_foto',
      detalhe: 'o anúncio não tem nenhuma foto',
      pergunta: 'Peça fotos de todos os cômodos antes de marcar a visita.',
    })
  } else if (nFotos < 5) {
    s.push({
      tipo: 'poucas_fotos',
      detalhe: `só ${nFotos} foto${nFotos > 1 ? 's' : ''} no anúncio`,
      pergunta: 'O que não está nas fotos? Peça banheiro, área de serviço e vista das janelas.',
    })
  }

  const tamDescricao = im.descricao?.trim().length ?? 0
  if (tamDescricao < 200) {
    s.push({
      tipo: 'descricao_curta',
      detalhe:
        tamDescricao === 0
          ? 'o anúncio não tem descrição'
          : 'a descrição tem menos de duas linhas',
      pergunta:
        'Estado de conservação, andar, posição solar e o que fica de armários — nada disso está escrito.',
    })
  }

  if (im.area_total == null) {
    s.push({
      tipo: 'sem_area_total',
      detalhe: 'só a área privativa foi informada',
      pergunta:
        'Qual a área total? A diferença entre as duas é o quanto você paga em área comum.',
    })
  }

  if (im.vagas == null) {
    s.push({
      tipo: 'sem_info_vaga',
      detalhe: 'o anúncio não diz se tem vaga',
      pergunta: 'Tem vaga? É escriturada, é coberta, e é rotativa ou fixa?',
    })
  }

  // Preço muito fora da curva do bairro merece explicação, não comemoração.
  if (ctx?.delta_mediana_pct != null && ctx.amostra >= 8) {
    if (ctx.delta_mediana_pct <= -25) {
      s.push({
        tipo: 'preco_abaixo_da_curva',
        detalhe: `${Math.abs(ctx.delta_mediana_pct)}% abaixo da mediana de ${ctx.base_comparacao}`,
        pergunta:
          'Por que está tão abaixo do bairro? Pergunte sobre pendências, inventário, ocupação e obras no prédio.',
      })
    } else if (ctx.delta_mediana_pct >= 30) {
      s.push({
        tipo: 'preco_acima_da_curva',
        detalhe: `${ctx.delta_mediana_pct}% acima da mediana de ${ctx.base_comparacao}`,
        pergunta: 'O que justifica o prêmio sobre os vizinhos? Reforma, andar, vista, vaga dupla?',
      })
    }
  }

  if (im.dados_conflitantes) {
    s.push({
      tipo: 'dados_conflitantes',
      detalhe: 'campos do anúncio se contradizem ou trazem valor implausível',
      pergunta: 'Confirme metragem, condomínio e IPTU por escrito antes de qualquer proposta.',
    })
  }

  return s
}

/** Quão completo é o anúncio, de 0 a 100. Só para ordenar, nunca para julgar. */
export function notaCompletude(im: Imovel): number {
  const campos = [
    im.condominio != null,
    im.iptu != null,
    Boolean(im.endereco),
    (im.fotos?.length ?? 0) >= 5,
    (im.descricao?.length ?? 0) >= 200,
    im.area_total != null,
    im.vagas != null,
    im.area != null,
    im.dormitorios != null,
  ]
  return Math.round((campos.filter(Boolean).length / campos.length) * 100)
}
