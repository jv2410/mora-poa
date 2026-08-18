import type { Imovel, Criterios, ImovelComScore } from './tipos'

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const norm = (s: string) => semAcento(s).toLowerCase().trim()

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

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

export function scoreImovel(im: Imovel, c: Criterios): ImovelComScore {
  const atende: string[] = []
  const nao_atende: string[] = []
  let somaPesos = 0
  let somaPontos = 0

  const avaliar = (peso: number, fracao: number, ok: string, ruim: string) => {
    somaPesos += peso
    somaPontos += peso * fracao
    if (fracao >= 1) atende.push(ok)
    else nao_atende.push(ruim)
  }

  if (c.preco_max != null) {
    avaliar(
      PESOS.orcamento,
      decaiTeto(im.preco, c.preco_max),
      `dentro do orçamento (${brl(im.preco)})`,
      `acima do orçamento: ${brl(im.preco)} contra ${brl(c.preco_max)}`
    )
  }

  if (c.preco_min != null) {
    avaliar(
      PESOS.orcamento / 2,
      im.preco >= c.preco_min ? 1 : 0,
      `acima do piso de ${brl(c.preco_min)}`,
      `abaixo do piso de ${brl(c.preco_min)}`
    )
  }

  if (c.dorm_min != null && im.dormitorios != null) {
    avaliar(
      PESOS.dormitorios,
      decaiMinimo(im.dormitorios, c.dorm_min),
      `${im.dormitorios} dormitórios`,
      `só ${im.dormitorios} dormitórios, você queria ${c.dorm_min}`
    )
  }

  if (c.vagas_min != null && im.vagas != null) {
    avaliar(
      PESOS.dormitorios / 2,
      decaiMinimo(im.vagas, c.vagas_min),
      `${im.vagas} vaga${im.vagas > 1 ? 's' : ''} de garagem`,
      `só ${im.vagas} vaga${im.vagas === 1 ? '' : 's'}, você queria ${c.vagas_min}`
    )
  }

  if (c.bairros?.length) {
    const alvos = c.bairros.map(norm)
    avaliar(
      PESOS.bairro,
      alvos.includes(norm(im.bairro)) ? 1 : 0,
      `fica no ${im.bairro}`,
      `fica no ${im.bairro}, fora dos bairros que você pediu`
    )
  }

  if (c.area_min != null && im.area != null) {
    avaliar(
      PESOS.area,
      decaiMinimo(im.area, c.area_min),
      `${im.area} m² privativos`,
      `${im.area} m², abaixo dos ${c.area_min} m² que você queria`
    )
  }

  if (c.custo_mensal_max != null && im.custo_mensal != null) {
    const custo = Number(im.custo_mensal)
    avaliar(
      PESOS.custo_mensal,
      decaiTeto(custo, c.custo_mensal_max),
      `custo mensal de ${brl(custo)} (condomínio + IPTU)`,
      `custo mensal de ${brl(custo)}, acima do teto de ${brl(c.custo_mensal_max)}`
    )
  }

  // Critério não informado não entra na conta — não pontua nem penaliza.
  // Critério informado cujo campo é nulo no imóvel também fica de fora:
  // punir um imóvel por dado que o portal não publicou seria injusto.
  const score = somaPesos === 0 ? 100 : Math.round((somaPontos / somaPesos) * 100)

  return { ...im, score, atende, nao_atende }
}

export function ranquear(imoveis: Imovel[], c: Criterios): ImovelComScore[] {
  return imoveis.map((i) => scoreImovel(i, c)).sort((a, b) => b.score - a.score)
}
