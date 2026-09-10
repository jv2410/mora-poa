import type { Imovel, Criterios, ImovelComScore, Faixa } from './tipos'

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const norm = (s: string) => semAcento(s).toLowerCase().trim()

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

/** "R$ 40 mil" — para deltas, onde o centavo só polui. */
const mil = (n: number) =>
  n >= 1000 ? `R$ ${Math.round(n / 1000)} mil` : brl(n)

/** 1.0 dentro do teto; decai linearmente até 0 a 20% acima dele. */
function decaiTeto(valor: number, teto: number): number {
  if (valor <= teto) return 1
  return Math.max(0, 1 - (valor - teto) / teto / 0.2)
}

/** 1.0 ao atingir o mínimo; decai linearmente até 0 a 50% abaixo dele. */
function decaiMinimo(valor: number, minimo: number): number {
  if (valor >= minimo) return 1
  return Math.max(0, 1 - (minimo - valor) / minimo / 0.5)
}

const PESOS = {
  orcamento: 30,
  dormitorios: 20,
  bairro: 20,
  area: 15,
  custo_mensal: 15,
} as const

/**
 * Um imóvel entra em "vale apresentar" com no máximo esta quantidade de
 * critérios furados. Três ressalvas não é uma ressalva, é outro imóvel — e
 * mandar isso para o cliente queima o corretor.
 */
const MAX_RESSALVAS = 2

/**
 * Quão perto o critério furado precisa estar de ser atendido. Medimos por
 * furo, não pelo score final: quando o corretor informa um critério só,
 * qualquer furo derruba a média, e um 2 dormitórios para quem pediu 3 — o
 * "vale apresentar" mais clássico que existe — seria descartado por
 * aritmética. 0.3 aceita errar um dormitório ou uma vaga e recusa quem está
 * ao dobro do teto de preço.
 */
const LIMITE_PROXIMIDADE = 0.3

export function scoreImovel(im: Imovel, c: Criterios): ImovelComScore {
  const atende: string[] = []
  const nao_atende: string[] = []
  /** Cada furo com a sua frase curta e o quanto faltou para atender. */
  const furos: Array<{ curto: string; fracao: number }> = []
  /** Critérios exigidos que o anúncio simplesmente não informa. */
  const desconhecidos: string[] = []
  let somaPesos = 0
  let somaPontos = 0

  /**
   * O critério foi pedido, mas o portal não publicou o dado. Não entra na
   * nota — punir o imóvel por omissão do anunciante seria injusto e mataria
   * metade do estoque. Mas também não pode passar como se atendesse: se o
   * cliente exigiu 2 vagas cobertas e o anúncio não fala de vaga, o corretor
   * precisa descobrir isso antes da visita, não na frente do comprador.
   */
  const naoInformado = (rotulo: string) => desconhecidos.push(rotulo)

  const avaliar = (
    peso: number,
    fracao: number,
    ok: string,
    ruim: string,
    curto: string
  ) => {
    somaPesos += peso
    somaPontos += peso * fracao
    if (fracao >= 1) {
      atende.push(ok)
    } else {
      nao_atende.push(ruim)
      furos.push({ curto, fracao })
    }
  }

  if (c.preco_max != null) {
    avaliar(
      PESOS.orcamento,
      decaiTeto(im.preco, c.preco_max),
      `dentro do orçamento (${brl(im.preco)})`,
      `acima do orçamento: ${brl(im.preco)} contra ${brl(c.preco_max)}`,
      `o teto de preço — ${mil(im.preco - c.preco_max)} acima`
    )
  }

  if (c.preco_min != null) {
    avaliar(
      PESOS.orcamento / 2,
      im.preco >= c.preco_min ? 1 : 0,
      `acima do piso de ${brl(c.preco_min)}`,
      `abaixo do piso de ${brl(c.preco_min)}`,
      `o piso de preço — ${mil(c.preco_min - im.preco)} abaixo`
    )
  }

  if (c.dorm_min != null && im.dormitorios == null) naoInformado('os dormitórios')
  if (c.dorm_min != null && im.dormitorios != null) {
    avaliar(
      PESOS.dormitorios,
      decaiMinimo(im.dormitorios, c.dorm_min),
      `${im.dormitorios} dormitórios`,
      `só ${im.dormitorios} dormitórios, o cliente pediu ${c.dorm_min}`,
      `os dormitórios — tem ${im.dormitorios}, pediram ${c.dorm_min}`
    )
  }

  if (c.vagas_min != null && im.vagas == null) naoInformado('as vagas de garagem')
  if (c.vagas_min != null && im.vagas != null) {
    avaliar(
      PESOS.dormitorios / 2,
      decaiMinimo(im.vagas, c.vagas_min),
      `${im.vagas} vaga${im.vagas > 1 ? 's' : ''} de garagem`,
      `só ${im.vagas} vaga${im.vagas === 1 ? '' : 's'}, o cliente pediu ${c.vagas_min}`,
      `as vagas — tem ${im.vagas}, pediram ${c.vagas_min}`
    )
  }

  if (c.bairros?.length) {
    const alvos = c.bairros.map(norm)
    avaliar(
      PESOS.bairro,
      alvos.includes(norm(im.bairro)) ? 1 : 0,
      `fica no ${im.bairro}`,
      `fica no ${im.bairro}, fora dos bairros pedidos`,
      `o bairro — é ${im.bairro}`
    )
  }

  if (c.area_min != null && im.area == null) naoInformado('a área privativa')
  if (c.area_min != null && im.area != null) {
    avaliar(
      PESOS.area,
      decaiMinimo(im.area, c.area_min),
      `${im.area} m² privativos`,
      `${im.area} m², abaixo dos ${c.area_min} m² pedidos`,
      `a área — ${im.area} m², pediram ${c.area_min}`
    )
  }

  if (c.custo_mensal_max != null && im.custo_mensal == null)
    naoInformado('o condomínio')
  if (c.custo_mensal_max != null && im.custo_mensal != null) {
    const custo = Number(im.custo_mensal)
    avaliar(
      PESOS.custo_mensal,
      decaiTeto(custo, c.custo_mensal_max),
      `custo mensal de ${brl(custo)} (condomínio + IPTU)`,
      `custo mensal de ${brl(custo)}, acima do teto de ${brl(c.custo_mensal_max)}`,
      `o custo mensal — ${mil(custo - c.custo_mensal_max)} acima do teto`
    )
  }

  // Critério não informado pelo corretor não entra na conta. Critério pedido
  // cujo dado o portal não publicou também fica fora da nota — mas foi
  // registrado em `desconhecidos` e reaparece na faixa.
  const score = somaPesos === 0 ? 100 : Math.round((somaPontos / somaPesos) * 100)

  return { ...im, score, atende, nao_atende, ...classificar(furos, desconhecidos) }
}

/**
 * Porcentagem é um número que o corretor precisa interpretar antes de decidir;
 * e "87% de match" não diz o que fazer com o imóvel. O que ele precisa saber é
 * se manda para o cliente sem pensar, se manda avisando de uma coisa, ou se
 * nem mostra. São três decisões, então três faixas — com o furo escrito por
 * extenso, porque a ressalva é a informação, não a nota.
 */
function classificar(
  furos: Array<{ curto: string; fracao: number }>,
  desconhecidos: string[]
): { faixa: Faixa; ressalva: string | null } {
  const lacuna = (() => {
    if (desconhecidos.length === 0) return null
    const lista =
      desconhecidos.length === 1
        ? desconhecidos[0]
        : `${desconhecidos.slice(0, -1).join(', ')} e ${desconhecidos.at(-1)}`
    return `o anúncio não informa ${lista} — confirme antes de apresentar`
  })()

  if (furos.length === 0) {
    // Dado ausente em critério exigido nunca vira alta compatibilidade. "Manda
    // sem pensar duas vezes" só pode ser dito de um imóvel que a gente
    // conseguiu verificar.
    return lacuna
      ? { faixa: 'ressalva', ressalva: `Atende o que dá para verificar, mas ${lacuna}` }
      : { faixa: 'alta', ressalva: null }
  }

  const piorFuro = Math.min(...furos.map((f) => f.fracao))
  const apresentavel = furos.length <= MAX_RESSALVAS && piorFuro >= LIMITE_PROXIMIDADE

  if (apresentavel) {
    const textos = furos.map((f) => f.curto)
    const base =
      textos.length === 1
        ? `Atende tudo, exceto ${textos[0]}`
        : `Atende o resto, mas furou ${textos.join(' e ')}`
    return { faixa: 'ressalva', ressalva: lacuna ? `${base}. E ${lacuna}` : base }
  }

  const plural = furos.length === 1 ? 'critério' : 'critérios'
  return { faixa: 'fora', ressalva: `Furou ${furos.length} ${plural}` }
}

/**
 * A partir de quantos dias sem confirmação o anúncio é tratado como suspeito.
 * Um mês é o prazo em que um imóvel vendido ainda costuma estar publicado: o
 * anunciante não tem pressa de tirar do ar, e o corretor que liga em cima
 * disso descobre na conversa que perdeu o tempo do cliente.
 */
export const DIAS_SUSPEITO = 30

export function ranquear(imoveis: Imovel[], c: Criterios): ImovelComScore[] {
  const ranqueados = imoveis
    .map((i) => scoreImovel(i, c))
    .map(avisarSeAntigo)
    // Anúncio velho vai para o fim da própria faixa: continua sendo uma opção
    // válida, mas não é o primeiro que o corretor deve tentar.
    .sort((a, b) => Number(estaAntigo(a)) - Number(estaAntigo(b)) || b.score - a.score)

  return compensarNoCusto(ranqueados)
}

function estaAntigo(im: ImovelComScore): boolean {
  return (im.dias_sem_confirmacao ?? 0) > DIAS_SUSPEITO
}

function avisarSeAntigo(im: ImovelComScore): ImovelComScore {
  if (!estaAntigo(im)) return im

  const aviso = `anúncio sem confirmação há ${im.dias_sem_confirmacao} dias — pode já estar vendido`
  return {
    ...im,
    // O aviso entra na ressalva porque é o texto que o corretor lê antes de
    // decidir. Um imóvel que atendia tudo deixa de ser "manda sem pensar".
    faixa: im.faixa === 'alta' ? 'ressalva' : im.faixa,
    ressalva: im.ressalva ? `${im.ressalva}. E o ${aviso}` : `O ${aviso}`,
  }
}

/**
 * Mínimo de imóveis "alta" com custo mensal conhecido para a mediana valer
 * como referência. Abaixo disso a comparação seria contra ruído.
 */
const MINIMO_PARA_MEDIANA = 3

/**
 * "R$ 40 mil acima do teto, mas condomínio R$ 600 mais barato" — o argumento
 * que transforma um imóvel descartado em uma conversa. Só é dito quando existe
 * base de comparação real: a mediana de custo mensal dos imóveis que batem
 * todos os critérios desta mesma busca.
 *
 * A conta acontece aqui, e não no `scoreImovel`, porque depende do conjunto
 * inteiro — um imóvel sozinho não sabe se é barato.
 */
function compensarNoCusto(lista: ImovelComScore[]): ImovelComScore[] {
  const custosAlta = lista
    .filter((i) => i.faixa === 'alta' && i.custo_mensal != null)
    .map((i) => Number(i.custo_mensal))
    .sort((a, b) => a - b)

  if (custosAlta.length < MINIMO_PARA_MEDIANA) return lista

  const meio = Math.floor(custosAlta.length / 2)
  const mediana =
    custosAlta.length % 2 === 0
      ? (custosAlta[meio - 1] + custosAlta[meio]) / 2
      : custosAlta[meio]

  return lista.map((im) => {
    const soFurouPreco =
      im.faixa === 'ressalva' && im.ressalva?.startsWith('Atende tudo, exceto o teto de preço')

    if (!soFurouPreco || im.custo_mensal == null) return im

    const economia = mediana - Number(im.custo_mensal)
    if (economia < 100) return im

    return {
      ...im,
      ressalva: `${im.ressalva} — em troca, custo mensal ${mil(economia)} abaixo da mediana dos que batem tudo`,
    }
  })
}
