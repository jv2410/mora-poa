import { describe, it, expect } from 'vitest'
import { executarTool, TOOLS } from '@/lib/tools'

describe('TOOLS', () => {
  it('declara as três tools em strict mode', () => {
    expect(TOOLS.map((t) => t.name).sort()).toEqual([
      'buscar_imoveis',
      'comparar_imoveis',
      'detalhar_imovel',
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

  it('compara imóveis pelos ids', async () => {
    const { imoveis } = await executarTool('buscar_imoveis', {})
    const ids = imoveis.slice(0, 3).map((i: any) => i.id)
    const r = await executarTool('comparar_imoveis', { ids })
    expect(r.imoveis).toHaveLength(3)
  })
})
