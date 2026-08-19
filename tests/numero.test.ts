import { describe, it, expect } from 'vitest'
import { numeroHumano, doTitulo } from '@/lib/fontes/comum'

describe('numeroHumano', () => {
  it('trata ponto como decimal quando o último grupo tem 1 ou 2 dígitos', () => {
    // O caso que quebrou 54 imóveis: 113.75 m² virava 11375 m²
    expect(numeroHumano('113.75')).toBe(113.75)
    expect(numeroHumano('82.1')).toBe(82.1)
  })

  it('trata ponto como milhar quando o último grupo tem 3 dígitos', () => {
    expect(numeroHumano('1.200')).toBe(1200)
    expect(numeroHumano('12.500')).toBe(12500)
  })

  it('vírgula sempre manda: ela é o decimal e o ponto vira milhar', () => {
    expect(numeroHumano('1.234,56')).toBe(1234.56)
    expect(numeroHumano('82,5')).toBe(82.5)
  })

  it('número simples passa direto', () => {
    expect(numeroHumano('78')).toBe(78)
  })
})

describe('doTitulo com áreas decimais', () => {
  it('lê área com ponto decimal', () => {
    expect(doTitulo('Apartamento 3 dorms, 113.75 m²').area).toBe(113.75)
  })

  it('lê área com vírgula decimal', () => {
    expect(doTitulo('Apartamento com 2 quartos e 82,5m²').area).toBe(82.5)
  })

  it('não confunde área grande de verdade com decimal', () => {
    expect(doTitulo('Cobertura de 1.200 m²').area).toBe(1200)
  })
})
