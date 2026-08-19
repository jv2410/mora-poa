import { describe, it, expect } from 'vitest'
import { itbiPoa, emolumentosRS, parcelaSAC, parcelaPrice, simularCompra } from '@/lib/financiamento'

describe('itbiPoa', () => {
  it('cobra 3% do valor', () => {
    expect(itbiPoa(500_000)).toBe(15_000)
    expect(itbiPoa(320_000)).toBe(9_600)
  })
})

describe('emolumentosRS', () => {
  it('usa a faixa correta', () => {
    expect(emolumentosRS(90_000).total).toBe(2_550)
    expect(emolumentosRS(450_000).total).toBe(7_700)
  })

  it('é monotônico: imóvel mais caro nunca paga menos', () => {
    const valores = [50_000, 150_000, 250_000, 400_000, 700_000, 1_000_000, 1_800_000, 5_000_000]
    for (let i = 1; i < valores.length; i++) {
      expect(emolumentosRS(valores[i]).total).toBeGreaterThanOrEqual(
        emolumentosRS(valores[i - 1]).total
      )
    }
  })
})

describe('parcelaSAC', () => {
  it('primeira parcela é maior que a última', () => {
    const r = parcelaSAC(400_000, 0.1149, 360)
    expect(r.primeira).toBeGreaterThan(r.ultima)
  })

  it('a amortização mensal bate com o principal dividido pelo prazo', () => {
    // 400k em 360 meses = 1.111,11 de amortização; a última parcela é
    // amortização + juros sobre ela, ou seja, pouco acima disso.
    const r = parcelaSAC(400_000, 0.1149, 360)
    expect(r.ultima).toBeGreaterThan(1_111)
    expect(r.ultima).toBeLessThan(1_130)
  })
})

describe('parcelaPrice', () => {
  it('devolve parcela fixa plausível', () => {
    const r = parcelaPrice(400_000, 0.1149, 360)
    expect(r.parcela).toBeGreaterThan(3_000)
    expect(r.parcela).toBeLessThan(4_500)
  })

  it('parcela do Price fica entre a primeira e a última do SAC', () => {
    const sac = parcelaSAC(400_000, 0.1149, 360)
    const price = parcelaPrice(400_000, 0.1149, 360)
    expect(price.parcela).toBeLessThan(sac.primeira)
    expect(price.parcela).toBeGreaterThan(sac.ultima)
  })

  it('SAC paga menos juros no total que o Price', () => {
    const sac = parcelaSAC(400_000, 0.1149, 360)
    const price = parcelaPrice(400_000, 0.1149, 360)
    expect(sac.total).toBeLessThan(price.total)
  })
})

describe('simularCompra', () => {
  it('soma entrada e custos de fechamento no dinheiro necessário', () => {
    const s = simularCompra({ preco: 500_000, entrada: 100_000 })
    // ITBI 15.000 + escritura 4.400 + registro 3.300 = 22.700
    expect(s.itbi).toBe(15_000)
    expect(s.custos_fechamento).toBe(22_700)
    expect(s.dinheiro_necessario).toBe(122_700)
    expect(s.financiado).toBe(400_000)
  })

  it('avisa quando a entrada está abaixo de 20%', () => {
    const s = simularCompra({ preco: 500_000, entrada: 50_000 })
    expect(s.observacoes.join(' ')).toMatch(/20%/)
  })

  it('avisa quando compromete mais de 30% da renda', () => {
    const s = simularCompra({
      preco: 500_000, entrada: 100_000, rendaMensal: 8_000,
      condominio: 800, iptu: 2_400,
    })
    expect(s.comprometimento_renda_pct).toBeGreaterThan(30)
    expect(s.observacoes.join(' ')).toMatch(/30%/)
  })

  it('inclui condomínio e IPTU no custo mensal de moradia', () => {
    const s = simularCompra({
      preco: 500_000, entrada: 100_000, condominio: 900, iptu: 1_200,
    })
    // parcela SAC inicial + 900 + 100 (IPTU/12)
    expect(s.custo_mensal_moradia).toBe(s.sac!.primeira + 1_000)
  })

  it('compra à vista não tem parcela, mas tem custo de fechamento', () => {
    const s = simularCompra({ preco: 300_000, entrada: 300_000 })
    expect(s.financiado).toBe(0)
    expect(s.sac).toBeNull()
    expect(s.custos_fechamento).toBeGreaterThan(0)
    expect(s.observacoes.join(' ')).toMatch(/à vista/)
  })

  it('sempre informa a referência das tabelas usadas', () => {
    expect(simularCompra({ preco: 400_000, entrada: 80_000 }).referencia).toMatch(/ITBI 3%/)
  })
})
