import { buscar, porId, porIds } from './db'
import { ranquear, scoreImovel } from './score'
import type { Criterios } from './tipos'
import { contextoMercado } from './mercado'
import { simularCompra, custoOportunidade } from './financiamento'
import { raioX } from './raioX'
import { oQueCompra } from './orcamento'
import { sinaisIncompletos, notaCompletude } from './completude'
import { alternativas } from './alternativas'

export const TOOLS = [
  {
    name: 'buscar_imoveis',
    description:
      'Busca apartamentos à venda em Porto Alegre no banco e devolve até 20 ranqueados ' +
      'por aderência aos critérios. Cada imóvel vem com "faixa": "alta" (atende todos os ' +
      'critérios informados) ou "ressalva" (atende quase tudo, e o campo "ressalva" diz ' +
      'exatamente o que furou). Quando nenhum imóvel é de alta compatibilidade, o campo ' +
      '"alternativas" traz contagens reais do banco de quantos imóveis apareceriam ' +
      'afrouxando cada critério — use isso em vez de dizer só "não encontrei". ' +
      'Chame assim que tiver ao menos um critério concreto — ' +
      'não espere ter todos. Informe apenas os critérios que a pessoa realmente mencionou: ' +
      'critério não informado não penaliza nenhum imóvel. Bairros disponíveis no banco: ' +
      "Moinhos de Vento, Petrópolis, Bela Vista, Bom Fim, Santana, Cidade Baixa, Jardim Europa, Menino Deus, Auxiliadora, Humaitá, Vila Nova, Morro Santana, Cavalhada, Centro Histórico, Rubem Berta, Passo da Areia, Santa Tereza, Farrapos, Cristal, Partenon, Sarandi, Tristeza e outros.",
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        preco_max: { type: ['number', 'null'], description: 'Teto de preço em reais' },
        preco_min: { type: ['number', 'null'], description: 'Piso de preço em reais' },
        bairros: {
          type: ['array', 'null'],
          items: { type: 'string' },
          description: 'Bairros de Porto Alegre desejados',
        },
        dorm_min: { type: ['integer', 'null'], description: 'Mínimo de dormitórios' },
        vagas_min: { type: ['integer', 'null'], description: 'Mínimo de vagas de garagem' },
        area_min: { type: ['number', 'null'], description: 'Área privativa mínima em m²' },
        custo_mensal_max: {
          type: ['number', 'null'],
          description: 'Teto de condomínio + IPTU mensal em reais',
        },
      },
      required: [
        'preco_max', 'preco_min', 'bairros', 'dorm_min',
        'vagas_min', 'area_min', 'custo_mensal_max',
      ],
      additionalProperties: false,
    },
  },
  {
    name: 'detalhar_imovel',
    description:
      'Devolve a ficha completa de um imóvel pelo id, incluindo descrição, ' +
      'fotos, área total e o link do anúncio original. Não devolve nome nem ' +
      'telefone de corretor ou proprietário — esse contato só existe na fonte.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { id: { type: 'integer' } },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'comparar_imoveis',
    description: 'Compara de 2 a 4 imóveis lado a lado pelos ids.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { ids: { type: 'array', items: { type: 'integer' } } },
      required: ['ids'],
      additionalProperties: false,
    },
  },
  {
    name: 'contexto_mercado',
    description:
      'Diz se o preço de um imóvel está caro ou barato comparado aos imóveis ' +
      'semelhantes do banco: devolve mediana, quartis e o percentil do preço ' +
      'por m² entre os comparáveis, junto do tamanho da amostra. Use sempre que ' +
      'a pessoa perguntar se vale a pena, se está caro, ou quando você quiser ' +
      'sustentar que um imóvel é oportunidade. Cite o tamanho da amostra: uma ' +
      'mediana de 3 anúncios não sustenta conclusão.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { id: { type: 'integer' } },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'raio_x_bairros',
    description:
      'Devolve o ranking de bairros de Porto Alegre por preço do m², com ' +
      'mediana, quartis, preço e área medianos e o tamanho da amostra de cada ' +
      'um. Use quando a pessoa perguntar onde é mais barato, onde vale mais a ' +
      'pena, quanto custa o m² num bairro, ou quando ela não souber em que ' +
      'bairro procurar. Também serve para situar o orçamento dela: com X reais ' +
      'e Y m² desejados, quais bairros cabem.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        dorm: {
          type: ['integer', 'null'],
          description: 'Filtra o ranking por número de dormitórios, se relevante',
        },
      },
      required: ['dorm'],
      additionalProperties: false,
    },
  },
  {
    name: 'o_que_compra',
    description:
      'Dado um orçamento, mostra o apartamento mediano que esse dinheiro compra ' +
      'em cada bairro de Porto Alegre, com quantos imóveis existem em cada um. ' +
      'Use quando a pessoa disser quanto tem para gastar mas não souber onde ' +
      'procurar, ou perguntar onde consegue morar com o dinheiro que tem.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        orcamento: { type: 'number', description: 'Quanto a pessoa tem para gastar, em reais' },
        dorm: { type: ['integer', 'null'], description: 'Mínimo de dormitórios, se relevante' },
      },
      required: ['orcamento', 'dorm'],
      additionalProperties: false,
    },
  },
  {
    name: 'simular_compra',
    description:
      'Calcula quanto custa de verdade comprar o imóvel: ITBI, escritura, ' +
      'registro, quanto dinheiro a pessoa precisa ter no dia da assinatura, ' +
      'parcela SAC e Price, e o custo mensal de moradia com condomínio e IPTU. ' +
      'Use quando a pessoa falar de entrada, financiamento, parcela ou renda. ' +
      'Os custos de fechamento surpreendem quase todo comprador de primeira ' +
      'viagem — vale mencionar mesmo sem ser perguntado.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        entrada: { type: 'number', description: 'Entrada em reais' },
        renda_mensal: { type: ['number', 'null'], description: 'Renda mensal familiar' },
        taxa_anual: { type: ['number', 'null'], description: 'Juros ao ano, ex 0.1149' },
        meses: { type: ['integer', 'null'], description: 'Prazo, padrão 360' },
      },
      required: ['id', 'entrada', 'renda_mensal', 'taxa_anual', 'meses'],
      additionalProperties: false,
    },
  },
] as const

/**
 * O strict mode obriga o modelo a mandar todas as chaves declaradas em
 * `required`, preenchendo com null as que não se aplicam. Removemos essas
 * antes de montar o SQL — senão um `preco_max: null` viraria filtro.
 */
function limpar(input: Record<string, unknown>): Criterios {
  return Object.fromEntries(
    Object.entries(input ?? {}).filter(
      ([, v]) => v != null && !(Array.isArray(v) && v.length === 0)
    )
  ) as Criterios
}

export async function executarTool(nome: string, input: any): Promise<any> {
  switch (nome) {
    case 'buscar_imoveis': {
      const c = limpar(input)
      // Busca uma margem maior no SQL e deixa o ranking decidir o corte —
      // um imóvel que estoura o teto em 3% pode ser a melhor opção da lista.
      const encontrados = await buscar(afrouxar(c), 60)
      const todosRanqueados = ranquear(encontrados, c)

      // "fora" não vai para o corretor: são imóveis que furaram três critérios
      // ou mais, e mandar isso ao cliente queima a credibilidade dele.
      const imoveis = todosRanqueados.filter((i) => i.faixa !== 'fora').slice(0, 20)
      const alta = imoveis.filter((i) => i.faixa === 'alta')
      const ressalva = imoveis.filter((i) => i.faixa === 'ressalva')

      return {
        criterios_aplicados: c,
        alta_compatibilidade: alta.length,
        vale_apresentar: ressalva.length,
        // Sem nada de alta compatibilidade, o valor da resposta passa a ser a
        // saída, não a lista. Só então gastamos as queries do contrafactual.
        alternativas: alta.length === 0 ? await alternativas(c) : null,
        imoveis,
      }
    }
    case 'detalhar_imovel': {
      const im = await porId(Number(input.id))
      if (!im) return { erro: `Nenhum imóvel com id ${input.id}.` }
      const ctx = await contextoMercado(im.id!)
      return {
        imovel: im,
        completude: notaCompletude(im),
        // O que o anúncio não conta é matéria de negociação, não detalhe.
        leve_para_a_visita: sinaisIncompletos(im, ctx),
      }
    }
    case 'comparar_imoveis': {
      const ids = (input.ids ?? []).map(Number)
      if (ids.length < 2) return { erro: 'Informe ao menos 2 ids para comparar.' }
      const imoveis = await porIds(ids.slice(0, 4))
      const ordenados = [...imoveis].sort((a, b) => a.preco - b.preco)
      const barato = ordenados[0]
      const caro = ordenados[ordenados.length - 1]

      return {
        imoveis: imoveis.map((i) => ({
          ...scoreImovel(i, {}),
          completude: notaCompletude(i),
          sinais_incompletos: sinaisIncompletos(i).map((s) => s.detalhe),
        })),
        // Reenquadra a decisão: o mais caro precisa valer essa diferença.
        custo_oportunidade:
          caro.preco > barato.preco
            ? custoOportunidade(caro.preco - barato.preco)
            : null,
      }
    }
    case 'raio_x_bairros': {
      const x = await raioX(input?.dorm ?? null)
      return {
        mediana_poa: x.geral.mediana,
        total_analisado: x.geral.n,
        filtro_dormitorios: x.dormFiltro,
        mais_caro: x.maisCaro,
        mais_barato: x.maisBarato,
        razao_caro_barato: x.razao,
        bairros: x.bairros,
      }
    }

    case 'o_que_compra': {
      const r = await oQueCompra(Number(input.orcamento), input?.dorm ?? null)
      return r
    }

    case 'contexto_mercado': {
      const ctx = await contextoMercado(Number(input.id))
      return ctx ?? { erro: 'Sem preço por m² para comparar este imóvel.' }
    }

    case 'simular_compra': {
      const im = await porId(Number(input.id))
      if (!im) return { erro: `Nenhum imóvel com id ${input.id}.` }

      // O preço vem SEMPRE do banco, nunca do que o modelo mandou.
      const s = simularCompra({
        preco: im.preco,
        entrada: Number(input.entrada) || 0,
        taxaAnual: input.taxa_anual ?? undefined,
        meses: input.meses ?? undefined,
        rendaMensal: input.renda_mensal ?? undefined,
        condominio: im.condominio,
        iptu: im.iptu,
      })
      return { imovel: { id: im.id, titulo: im.titulo, bairro: im.bairro }, simulacao: s }
    }

    default:
      return { erro: `Tool desconhecida: ${nome}` }
  }
}

/** Alarga os tetos em 20% no SQL para o ranking poder considerar quase-matches. */
function afrouxar(c: Criterios): Criterios {
  return {
    ...c,
    preco_max: c.preco_max != null ? c.preco_max * 1.2 : undefined,
    custo_mensal_max: c.custo_mensal_max != null ? c.custo_mensal_max * 1.2 : undefined,
    dorm_min: c.dorm_min != null ? Math.max(1, c.dorm_min - 1) : undefined,
    area_min: c.area_min != null ? c.area_min * 0.7 : undefined,
    vagas_min: undefined,
  }
}
