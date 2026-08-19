import { describe, it, expect } from 'vitest'
import { executarTool, TOOLS } from '@/lib/tools'

describe('TOOLS', () => {
  it('declara as seis tools em strict mode', () => {
    expect(TOOLS.map((t) => t.name).sort()).toEqual([
      'buscar_imoveis',
      'comparar_imoveis',
      'contexto_mercado',
      'detalhar_imovel',
      'raio_x_bairros',
      'simular_compra',
    ])
    expect(TOOLS.every((t) => t.strict === true)).toBe(true)
    expect(TOOLS.every((t) => t.input_schema.additionalProperties === false)).toBe(true)
  })
})

describe('executarTool', () => {
  it('busca e ordena por score decrescente', async () => {
    const r = await executarTool('buscar_imoveis', { preco_max: 600000, dorm_min: 2 })
    expect(r.imoveis.length).toBeGreaterThan(0)
    for (let i = 1; i < r.imoveis.length; i++) {
      expect(r.imoveis[i - 1].score).toBeGreaterThanOrEqual(r.imoveis[i].score)
    }
  })

  it('cada resultado traz score e justificativa', async () => {
    const { imoveis } = await executarTool('buscar_imoveis', { preco_max: 700000 })
    expect(imoveis[0]).toHaveProperty('score')
    expect(Array.isArray(imoveis[0].atende)).toBe(true)
    expect(Array.isArray(imoveis[0].nao_atende)).toBe(true)
  })

  it('ignora as chaves nulas que o strict mode obriga o modelo a mandar', async () => {
    const r = await executarTool('buscar_imoveis', {
      preco_max: 600000, preco_min: null, bairros: null,
      dorm_min: null, vagas_min: null, area_min: null, custo_mensal_max: null,
    })
    expect(r.criterios_aplicados).toEqual({ preco_max: 600000 })
    expect(r.imoveis.length).toBeGreaterThan(0)
  })

  it('filtra por bairro ignorando acento', async () => {
    const r = await executarTool('buscar_imoveis', { bairros: ['petropolis'] })
    expect(r.imoveis.length).toBeGreaterThan(0)
    expect(r.imoveis.every((i: any) => i.bairro === 'Petrópolis')).toBe(true)
  })

  it('detalha um imóvel existente', async () => {
    const { imoveis } = await executarTool('buscar_imoveis', {})
    const r = await executarTool('detalhar_imovel', { id: imoveis[0].id })
    expect(r.imovel.id).toBe(imoveis[0].id)
  })

  it('devolve erro legível para id inexistente', async () => {
    const r = await executarTool('detalhar_imovel', { id: 999999 })
    expect(r.erro).toBeTruthy()
  })

  it('contexto de mercado sempre informa a amostra e a base de comparação', async () => {
    const { imoveis } = await executarTool('buscar_imoveis', {})
    const alvo = imoveis.find((i: any) => i.preco_m2 != null)
    const r = await executarTool('contexto_mercado', { id: alvo.id })
    expect(r.amostra).toBeGreaterThan(0)
    expect(r.base_comparacao).toBeTruthy()
    expect(r.leitura).toBeTruthy()
    // O percentil tem que ser coerente com o delta contra a mediana
    if (r.delta_mediana_pct < 0) expect(r.percentil).toBeLessThan(55)
  })

  it('simulação usa o preço do banco, não o que o modelo mandar', async () => {
    const { imoveis } = await executarTool('buscar_imoveis', {})
    const alvo = imoveis[0]
    const r = await executarTool('simular_compra', {
      id: alvo.id, entrada: 50000, preco: 999999999, renda_mensal: null,
      taxa_anual: null, meses: null,
    })
    expect(r.simulacao.preco).toBe(Number(alvo.preco))
    expect(r.simulacao.dinheiro_necessario).toBeGreaterThan(50000)
  })

  it('raio-x devolve ranking com amostra e nunca mediana absurda', async () => {
    const r = await executarTool('raio_x_bairros', { dorm: null })
    expect(r.bairros.length).toBeGreaterThan(5)
    expect(r.mediana_poa).toBeGreaterThan(2000)
    expect(r.razao_caro_barato).toBeGreaterThan(1)
    for (const b of r.bairros) {
      expect(b.n).toBeGreaterThanOrEqual(5)
      // a faixa de sanidade tem que estar valendo
      expect(b.mediana).toBeGreaterThan(1500)
      expect(b.mediana).toBeLessThan(40000)
      expect(b.p25).toBeLessThanOrEqual(b.mediana)
      expect(b.mediana).toBeLessThanOrEqual(b.p75)
    }
    // ordenado do mais caro para o mais barato
    for (let i = 1; i < r.bairros.length; i++) {
      expect(r.bairros[i - 1].mediana).toBeGreaterThanOrEqual(r.bairros[i].mediana)
    }
  })

  it('compara imóveis pelos ids', async () => {
    const { imoveis } = await executarTool('buscar_imoveis', {})
    const ids = imoveis.slice(0, 3).map((i: any) => i.id)
    const r = await executarTool('comparar_imoveis', { ids })
    expect(r.imoveis).toHaveLength(3)
  })
})
