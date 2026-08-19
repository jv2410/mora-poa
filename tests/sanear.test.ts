import { describe, it, expect } from 'vitest'
import { sanear } from '@/lib/db'
import type { Imovel } from '@/lib/tipos'

const base: Imovel = {
  fonte: 'x', codigo_origem: 'x-1', url_origem: 'x', titulo: 'Apto', descricao: null,
  preco: 420000, condominio: 500, iptu: 1200, area: 80, area_total: null,
  dormitorios: 2, suites: null, banheiros: 1, vagas: 1, bairro: 'Bom Fim',
  endereco: null, cidade: 'Porto Alegre', latitude: null, longitude: null,
  caracteristicas: [], fotos: [], corretor_nome: null, corretor_telefone: null,
  publicado_em: null, dados_conflitantes: false,
}

describe('sanear', () => {
  it('deixa passar condomínio normal', () => {
    const r = sanear(base)
    expect(r.condominio).toBe(500)
    expect(r.dados_conflitantes).toBe(false)
  })

  it('descarta o condomínio impossível que a Guarida publica', () => {
    // Caso real: R$ 47.336 de condomínio num apê de R$ 420 mil
    const r = sanear({ ...base, condominio: 47336 })
    expect(r.condominio).toBeNull()
    expect(r.dados_conflitantes).toBe(true)
  })

  it('mantém condomínio alto quando o imóvel é caro de verdade', () => {
    // Cobertura de R$ 8,8 milhões com R$ 10 mil de condomínio é real
    const r = sanear({ ...base, preco: 8_800_000, condominio: 10_000 })
    expect(r.condominio).toBe(10_000)
    expect(r.dados_conflitantes).toBe(false)
  })

  it('descarta IPTU acima de 10% do valor do imóvel', () => {
    const r = sanear({ ...base, iptu: 36_407 })
    expect(r.iptu).toBeNull()
    expect(r.dados_conflitantes).toBe(true)
  })

  it('preserva o campo bom quando só o outro é suspeito', () => {
    const r = sanear({ ...base, condominio: 47336, iptu: 1200 })
    expect(r.condominio).toBeNull()
    expect(r.iptu).toBe(1200)
  })
})
