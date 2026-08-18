import { describe, it, expect } from 'vitest'
import { scoreImovel, ranquear } from '@/lib/score'
import type { Imovel } from '@/lib/tipos'

const base: Imovel = {
  codigo_origem: '1', url_origem: 'x', titulo: 'Apto', descricao: null,
  preco: 500000, condominio: 800, iptu: 1200, area: 80, area_total: 110,
  dormitorios: 2, suites: 1, banheiros: 2, vagas: 1,
  bairro: 'Menino Deus', endereco: null, cidade: 'Porto Alegre',
  fotos: [], corretor_nome: null, corretor_telefone: null,
  publicado_em: null, dados_conflitantes: false, custo_mensal: 900,
}

describe('scoreImovel', () => {
  it('dá 100 quando nenhum critério foi informado', () => {
    expect(scoreImovel(base, {}).score).toBe(100)
  })

  it('dá 100 quando o imóvel atende a tudo', () => {
    const r = scoreImovel(base, { preco_max: 600000, dorm_min: 2, bairros: ['Menino Deus'] })
    expect(r.score).toBe(100)
    expect(r.nao_atende).toHaveLength(0)
    expect(r.atende).toHaveLength(3)
  })

  it('penaliza sem zerar quando estoura pouco o orçamento', () => {
    const r = scoreImovel(base, { preco_max: 480000 })
    expect(r.score).toBeGreaterThan(0)
    expect(r.score).toBeLessThan(100)
    expect(r.nao_atende[0]).toMatch(/orçamento/i)
  })

  it('zera o critério quando estoura muito o orçamento', () => {
    expect(scoreImovel(base, { preco_max: 200000 }).score).toBe(0)
  })

  it('normaliza: um critério atendido entre dois vale 50', () => {
    const r = scoreImovel(base, { dorm_min: 2, bairros: ['Petrópolis'] })
    expect(r.score).toBe(50)
  })

  it('ignora critério cujo campo é nulo no imóvel', () => {
    const semVagas = { ...base, vagas: null }
    expect(scoreImovel(semVagas, { vagas_min: 2, dorm_min: 2 }).score).toBe(100)
  })

  it('compara bairro sem diferenciar acento ou caixa', () => {
    const r = scoreImovel({ ...base, bairro: 'Centro Histórico' }, { bairros: ['centro historico'] })
    expect(r.score).toBe(100)
  })

  it('devolve score inteiro entre 0 e 100', () => {
    const r = scoreImovel(base, { preco_max: 490000, dorm_min: 3, area_min: 100 })
    expect(Number.isInteger(r.score)).toBe(true)
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(100)
  })

  it('explica em português o que atende e o que não', () => {
    const r = scoreImovel(base, { preco_max: 400000, dorm_min: 2 })
    expect(r.atende.join(' ')).toContain('dormitórios')
    expect(r.nao_atende.join(' ')).toMatch(/R\$/)
  })
})

describe('ranquear', () => {
  it('ordena do maior para o menor score', () => {
    const caro = { ...base, preco: 900000 }
    const barato = { ...base, preco: 400000 }
    const r = ranquear([caro, barato], { preco_max: 450000 })
    expect(r[0].preco).toBe(400000)
    expect(r[0].score).toBeGreaterThanOrEqual(r[1].score)
  })
})
