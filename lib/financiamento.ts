/**
 * Quanto custa DE VERDADE comprar um apartamento em Porto Alegre.
 *
 * A dor mais universal do comprador brasileiro de primeira viagem é descobrir
 * na véspera da escritura que precisa de mais R$ 25 a 35 mil além da entrada,
 * para ITBI e cartório. Nenhum portal mostra isso no anúncio.
 *
 * Tudo aqui é aritmética pura em TypeScript, testada. O LLM passa os
 * parâmetros que a pessoa disse e narra o resultado — não calcula nada.
 */

/** ITBI de Porto Alegre: 3% sobre o valor venal de transmissão. Lei Complementar 197/1989. */
const ALIQUOTA_ITBI_POA = 0.03

/**
 * Emolumentos do RS (escritura + registro), tabela 2026, em faixas de valor.
 * Valores aproximados de tabela — a fonte oficial é a Corregedoria-Geral de
 * Justiça do RS, e a tabela muda todo ano. Por isso a referência sai junto do
 * resultado, para o usuário saber de quando é o número que está lendo.
 */
const REFERENCIA_EMOLUMENTOS = 'tabela de emolumentos RS, 2026 (aproximada)'

const FAIXAS_EMOLUMENTOS: { ate: number; escritura: number; registro: number }[] = [
  { ate: 100_000, escritura: 1_450, registro: 1_100 },
  { ate: 200_000, escritura: 2_300, registro: 1_750 },
  { ate: 300_000, escritura: 3_100, registro: 2_350 },
  { ate: 500_000, escritura: 4_400, registro: 3_300 },
  { ate: 800_000, escritura: 6_200, registro: 4_650 },
  { ate: 1_200_000, escritura: 8_100, registro: 6_100 },
  { ate: 2_000_000, escritura: 10_800, registro: 8_100 },
  { ate: Infinity, escritura: 14_500, registro: 10_900 },
]

export function itbiPoa(preco: number): number {
  return Math.round(preco * ALIQUOTA_ITBI_POA)
}

export function emolumentosRS(preco: number): { escritura: number; registro: number; total: number } {
  const faixa = FAIXAS_EMOLUMENTOS.find((f) => preco <= f.ate)!
  return {
    escritura: faixa.escritura,
    registro: faixa.registro,
    total: faixa.escritura + faixa.registro,
  }
}

/** SAC: amortização constante, primeira parcela mais alta, decrescente. */
export function parcelaSAC(financiado: number, taxaAnual: number, meses: number) {
  const i = Math.pow(1 + taxaAnual, 1 / 12) - 1
  const amortizacao = financiado / meses
  const primeira = amortizacao + financiado * i
  const ultima = amortizacao + amortizacao * i
  return {
    primeira: Math.round(primeira),
    ultima: Math.round(ultima),
    total: Math.round(((primeira + ultima) / 2) * meses),
  }
}

/** Price: parcela fixa do começo ao fim. */
export function parcelaPrice(financiado: number, taxaAnual: number, meses: number) {
  const i = Math.pow(1 + taxaAnual, 1 / 12) - 1
  const p = (financiado * i) / (1 - Math.pow(1 + i, -meses))
  return { parcela: Math.round(p), total: Math.round(p * meses) }
}

export type SimulacaoCompra = {
  preco: number
  entrada: number
  financiado: number
  itbi: number
  escritura: number
  registro: number
  custos_fechamento: number
  dinheiro_necessario: number
  falta: number | null
  sac: { primeira: number; ultima: number; total: number } | null
  price: { parcela: number; total: number } | null
  custo_mensal_moradia: number | null
  comprometimento_renda_pct: number | null
  referencia: string
  observacoes: string[]
}

export function simularCompra(args: {
  preco: number
  entrada: number
  taxaAnual?: number
  meses?: number
  rendaMensal?: number
  condominio?: number | null
  iptu?: number | null
}): SimulacaoCompra {
  const { preco, entrada } = args
  const taxaAnual = args.taxaAnual ?? 0.1149 // taxa de mercado típica em 2026
  const meses = args.meses ?? 360

  const itbi = itbiPoa(preco)
  const emol = emolumentosRS(preco)
  const custos_fechamento = itbi + emol.total
  const dinheiro_necessario = entrada + custos_fechamento
  const financiado = Math.max(0, preco - entrada)

  const sac = financiado > 0 ? parcelaSAC(financiado, taxaAnual, meses) : null
  const price = financiado > 0 ? parcelaPrice(financiado, taxaAnual, meses) : null

  const mensalImovel =
    (args.condominio ?? 0) + (args.iptu != null ? args.iptu / 12 : 0)
  const custo_mensal_moradia = sac ? Math.round(sac.primeira + mensalImovel) : null

  const comprometimento =
    args.rendaMensal && custo_mensal_moradia
      ? Math.round((custo_mensal_moradia / args.rendaMensal) * 1000) / 10
      : null

  const observacoes: string[] = []

  if (entrada < preco * 0.2) {
    observacoes.push(
      'entrada abaixo de 20% do valor — a maioria dos bancos exige pelo menos isso'
    )
  }
  if (comprometimento != null && comprometimento > 30) {
    observacoes.push(
      `comprometimento de ${comprometimento}% da renda — bancos costumam recusar acima de 30%`
    )
  }
  if (financiado === 0) {
    observacoes.push('compra à vista: sem parcelas, mas os custos de fechamento continuam')
  }

  return {
    preco,
    entrada,
    financiado,
    itbi,
    escritura: emol.escritura,
    registro: emol.registro,
    custos_fechamento,
    dinheiro_necessario,
    falta: null,
    sac,
    price,
    custo_mensal_moradia,
    comprometimento_renda_pct: comprometimento,
    referencia: `ITBI 3% (Porto Alegre) e ${REFERENCIA_EMOLUMENTOS}`,
    observacoes,
  }
}
