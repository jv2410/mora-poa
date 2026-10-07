import { describe, it, expect, beforeAll, vi } from 'vitest'
import type { Imovel } from '@/lib/tipos'

/**
 * A marcação de anúncio antigo é desligada por padrão e ligada por ambiente
 * (DIAS_ANUNCIO_SUSPEITO). O limite é lido quando o módulo carrega, então a
 * variável precisa estar definida antes do import — daí o import dinâmico
 * dentro do beforeAll, em arquivo separado dos demais testes de faixa.
 */
let ranquear: typeof import('@/lib/score').ranquear

beforeAll(async () => {
  process.env.DIAS_ANUNCIO_SUSPEITO = '30'
  ;({ ranquear } = await import('@/lib/score'))
})

const base: Imovel = {
  fonte: 'teste', codigo_origem: 'x1', url_origem: 'http://x', titulo: 'Apto',
  descricao: null, preco: 500_000, condominio: 600, iptu: 100, area: 70,
  area_total: null, dormitorios: 2, suites: null, banheiros: 1, vagas: 1,
  bairro: 'Petrópolis', endereco: null, cidade: 'Porto Alegre',
  latitude: null, longitude: null, caracteristicas: [], fotos: [],
  publicado_em: null, dados_conflitantes: false, custo_mensal: 700,
}

describe('anúncio zumbi, com a marcação ligada', () => {
  it('anúncio velho perde a alta compatibilidade e diz quantos dias', () => {
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
})

describe('com a marcação desligada, que é o padrão', () => {
  it('idade do anúncio não interfere na faixa', async () => {
    // Módulo recarregado sem a variável: o mesmo imóvel de 400 dias passa
    // normalmente, porque a cadência da fonte não comporta esse limite.
    process.env.DIAS_ANUNCIO_SUSPEITO = '0'
    vi.resetModules()
    const { ranquear: semMarcacao } = await import('@/lib/score')
    const [im] = semMarcacao([{ ...base, dias_sem_confirmacao: 400 }], { preco_max: 600_000 })
    expect(im.faixa).toBe('alta')
    expect(im.ressalva).toBeNull()
  })
})
