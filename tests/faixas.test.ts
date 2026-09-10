import { describe, it, expect } from 'vitest'
import { scoreImovel, ranquear } from '@/lib/score'
import { alternativas } from '@/lib/alternativas'
import { executarTool } from '@/lib/tools'
import type { Imovel } from '@/lib/tipos'

const base: Imovel = {
  fonte: 'teste', codigo_origem: 'x1', url_origem: 'http://x', titulo: 'Apto',
  descricao: null, preco: 500_000, condominio: 600, iptu: 100, area: 70,
  area_total: null, dormitorios: 2, suites: null, banheiros: 1, vagas: 1,
  bairro: 'Petrópolis', endereco: null, cidade: 'Porto Alegre',
  latitude: null, longitude: null, caracteristicas: [], fotos: [],
  publicado_em: null, dados_conflitantes: false, custo_mensal: 700,
}

describe('faixa de compatibilidade', () => {
  it('atender todos os critérios informados dá alta, sem ressalva', () => {
    const r = scoreImovel(base, { preco_max: 600_000, dorm_min: 2, bairros: ['Petrópolis'] })
    expect(r.faixa).toBe('alta')
    expect(r.ressalva).toBeNull()
    expect(r.nao_atende).toEqual([])
  })

  it('sem critério nenhum ainda é alta — não há o que furar', () => {
    expect(scoreImovel(base, {}).faixa).toBe('alta')
  })

  it('um furo só vira ressalva com o furo escrito por extenso', () => {
    const r = scoreImovel(base, { preco_max: 460_000, dorm_min: 2 })
    expect(r.faixa).toBe('ressalva')
    expect(r.ressalva).toBe('Atende tudo, exceto o teto de preço — R$ 40 mil acima')
  })

  it('a ressalva nomeia o critério certo, não o primeiro qualquer', () => {
    const r = scoreImovel(base, { dorm_min: 3 })
    expect(r.ressalva).toContain('os dormitórios')
    expect(r.ressalva).toContain('tem 2, pediram 3')
  })

  it('três furos saem da vitrine em vez de virar ressalva longa', () => {
    const r = scoreImovel(base, {
      preco_max: 300_000, dorm_min: 4, bairros: ['Moinhos de Vento'], area_min: 200,
    })
    expect(r.faixa).toBe('fora')
    expect(r.ressalva).toContain('critérios')
  })

  it('dado ausente em critério exigido nunca vira alta compatibilidade', () => {
    // O caso que quebrava: cliente exige 2 vagas, anúncio não fala de vaga.
    // Antes isso passava como "manda sem pensar duas vezes".
    const semVaga = { ...base, vagas: null }
    const r = scoreImovel(semVaga, { preco_max: 600_000, dorm_min: 2, vagas_min: 2 })
    expect(r.faixa).toBe('ressalva')
    expect(r.ressalva).toContain('não informa as vagas de garagem')
    expect(r.ressalva).toContain('confirme antes de apresentar')
  })

  it('lista todas as lacunas quando falta mais de um dado', () => {
    const cru = { ...base, vagas: null, custo_mensal: null }
    const r = scoreImovel(cru, { vagas_min: 1, custo_mensal_max: 800 })
    expect(r.ressalva).toContain('as vagas de garagem')
    expect(r.ressalva).toContain('o condomínio')
  })

  it('lacuna e furo aparecem juntos, sem um esconder o outro', () => {
    const r = scoreImovel({ ...base, vagas: null }, { preco_max: 460_000, vagas_min: 2 })
    expect(r.ressalva).toContain('o teto de preço')
    expect(r.ressalva).toContain('não informa as vagas')
  })

  it('critério não pedido pelo corretor não gera lacuna nenhuma', () => {
    const r = scoreImovel({ ...base, vagas: null }, { preco_max: 600_000 })
    expect(r.faixa).toBe('alta')
    expect(r.ressalva).toBeNull()
  })

  it('furo pequeno mas score no chão não é ressalva', () => {
    // 90% acima do teto: um furo só, mas o imóvel não é dessa conversa.
    const r = scoreImovel({ ...base, preco: 950_000 }, { preco_max: 500_000 })
    expect(r.faixa).toBe('fora')
  })
})

describe('anúncio zumbi', () => {
  it('anúncio velho perde a alta compatibilidade e avisa quantos dias', () => {
    const [im] = ranquear([{ ...base, dias_sem_confirmacao: 44 }], { preco_max: 600_000 })
    expect(im.faixa).toBe('ressalva')
    expect(im.ressalva).toContain('44 dias')
    expect(im.ressalva).toContain('pode já estar vendido')
  })

  it('anúncio recente não recebe aviso nenhum', () => {
    const [im] = ranquear([{ ...base, dias_sem_confirmacao: 3 }], { preco_max: 600_000 })
    expect(im.faixa).toBe('alta')
    expect(im.ressalva).toBeNull()
  })

  it('sem histórico não é tratado como fresco nem como velho', () => {
    const [im] = ranquear([{ ...base, dias_sem_confirmacao: null }], { preco_max: 600_000 })
    expect(im.faixa).toBe('alta')
  })

  it('o velho cai para depois do novo mesmo tendo score melhor', () => {
    const lista = ranquear(
      [
        { ...base, codigo_origem: 'velho', preco: 400_000, dias_sem_confirmacao: 60 },
        { ...base, codigo_origem: 'novo', preco: 590_000, dias_sem_confirmacao: 2 },
      ],
      { preco_max: 600_000 }
    )
    expect(lista.map((i) => i.codigo_origem)).toEqual(['novo', 'velho'])
  })

  it('o aviso de velho não apaga a ressalva que já existia', () => {
    const [im] = ranquear(
      [{ ...base, vagas: null, dias_sem_confirmacao: 50 }],
      { preco_max: 600_000, vagas_min: 2 }
    )
    expect(im.ressalva).toContain('não informa as vagas')
    expect(im.ressalva).toContain('50 dias')
  })
})

describe('compensação no custo mensal', () => {
  it('cita a economia real contra a mediana dos que batem tudo', () => {
    const criterios = { preco_max: 500_000 }
    const lista = ranquear(
      [
        { ...base, codigo_origem: 'a', preco: 480_000, custo_mensal: 1500 },
        { ...base, codigo_origem: 'b', preco: 490_000, custo_mensal: 1400 },
        { ...base, codigo_origem: 'c', preco: 495_000, custo_mensal: 1300 },
        // Estoura o teto, mas é muito mais barato de manter.
        { ...base, codigo_origem: 'd', preco: 540_000, custo_mensal: 700 },
      ],
      criterios
    )

    const caro = lista.find((i) => i.codigo_origem === 'd')!
    expect(caro.faixa).toBe('ressalva')
    // mediana dos "alta" é 1400; 1400 - 700 = 700
    expect(caro.ressalva!.replace(/\u00a0/g, ' ')).toContain('R$ 700 abaixo da mediana')
  })

  it('não inventa comparação quando faltam imóveis para a mediana', () => {
    const lista = ranquear(
      [
        { ...base, codigo_origem: 'a', preco: 480_000, custo_mensal: 1500 },
        { ...base, codigo_origem: 'd', preco: 540_000, custo_mensal: 700 },
      ],
      { preco_max: 500_000 }
    )
    expect(lista.find((i) => i.codigo_origem === 'd')!.ressalva).not.toContain('mediana')
  })
})

describe('alternativas quando não há match', () => {
  it('cada alternativa destrava um número real de imóveis', async () => {
    // Combinação deliberadamente impossível no banco.
    const alts = await alternativas({
      preco_max: 200_000, dorm_min: 4, bairros: ['Moinhos de Vento'], vagas_min: 3,
    })
    expect(alts.length).toBeGreaterThan(0)
    for (const a of alts) {
      expect(a.quantos).toBeGreaterThan(0)
      expect(a.mudanca).toBeTruthy()
    }
  })

  it('vêm ordenadas por quanto destravam', async () => {
    const alts = await alternativas({ preco_max: 250_000, dorm_min: 3, vagas_min: 2 })
    for (let i = 1; i < alts.length; i++) {
      expect(alts[i - 1].quantos).toBeGreaterThanOrEqual(alts[i].quantos)
    }
  })

  it('o esticão de teto sugerido de fato contém aquela quantidade', async () => {
    const alts = await alternativas({ preco_max: 150_000, dorm_min: 3 })
    const teto = alts.find((a) => a.criterio === 'preco_max')
    if (teto) {
      // A frase carrega o valor; confirmamos que ele é maior que o teto original.
      const valor = Number(teto.mudanca.replace(/\D/g, ''))
      expect(valor).toBeGreaterThan(150)
    }
  })
})

describe('a tool devolve as faixas separadas', () => {
  it('conta alta e ressalva, e não devolve imóvel fora de faixa', async () => {
    const r = await executarTool('buscar_imoveis', { preco_max: 600_000, dorm_min: 2 })
    expect(r.alta_compatibilidade + r.vale_apresentar).toBe(r.imoveis.length)
    expect(r.imoveis.every((i: any) => i.faixa !== 'fora')).toBe(true)
  })

  it('só gasta query de alternativa quando não há alta compatibilidade', async () => {
    const comMatch = await executarTool('buscar_imoveis', { preco_max: 900_000 })
    expect(comMatch.alta_compatibilidade).toBeGreaterThan(0)
    expect(comMatch.alternativas).toBeNull()
  })

  it('sem nada de alta compatibilidade, entrega as saídas', async () => {
    const r = await executarTool('buscar_imoveis', {
      preco_max: 120_000, dorm_min: 4, bairros: ['Moinhos de Vento'],
      vagas_min: null, area_min: null, custo_mensal_max: null, preco_min: null,
    })
    expect(r.alta_compatibilidade).toBe(0)
    expect(r.alternativas.length).toBeGreaterThan(0)
  })
})
