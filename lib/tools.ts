import { buscar, porId, porIds } from './db'
import { ranquear, scoreImovel } from './score'
import type { Criterios } from './tipos'

export const TOOLS = [
  {
    name: 'buscar_imoveis',
    description:
      'Busca apartamentos à venda em Porto Alegre no banco e devolve até 20 ranqueados ' +
      'por aderência aos critérios, cada um com score de 0 a 100 e as listas "atende" e ' +
      '"nao_atende" já calculadas. Chame assim que tiver ao menos um critério concreto — ' +
      'não espere ter todos. Informe apenas os critérios que a pessoa realmente mencionou: ' +
      'critério não informado não penaliza nenhum imóvel. Bairros disponíveis no banco: ' +
      'Moinhos de Vento, Santana, Bom Fim, Cidade Baixa, Petrópolis.',
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
      'fotos, área total e dados do corretor.',
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
      const imoveis = ranquear(encontrados, c).slice(0, 20)
      return { total: imoveis.length, criterios_aplicados: c, imoveis }
    }
    case 'detalhar_imovel': {
      const im = await porId(Number(input.id))
      return im ? { imovel: im } : { erro: `Nenhum imóvel com id ${input.id}.` }
    }
    case 'comparar_imoveis': {
      const ids = (input.ids ?? []).map(Number)
      if (ids.length < 2) return { erro: 'Informe ao menos 2 ids para comparar.' }
      const imoveis = await porIds(ids.slice(0, 4))
      return { imoveis: imoveis.map((i) => scoreImovel(i, {})) }
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
