import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { parsearImovel as parseFoxter, extrairIdsDaListagem as idsFoxter } from '@/lib/fontes/foxter'
import { parsearImovel as parseGuarida, extrairIdsDaListagem as idsGuarida } from '@/lib/fontes/guarida'

const htmlFoxter = readFileSync('tests/fixtures/foxter-161568.html', 'utf-8')
const htmlGuarida = readFileSync('tests/fixtures/guarida-5357.html', 'utf-8')

describe('Foxter', () => {
  const im = parseFoxter(htmlFoxter, 'https://www.foxterciaimobiliaria.com.br/imovel/161568')!

  it('parseia o anúncio', () => {
    expect(im).not.toBeNull()
    expect(im.fonte).toBe('foxter')
    expect(im.codigo_origem).toBe('foxter-161568')
    expect(im.preco).toBe(185000)
  })

  it('extrai dormitórios e área da descrição', () => {
    // "Foxter vende Apartamento Residencial , 39m2, 2 dorms em condomínio
    //  no bairro Petrópolis em Porto Alegre"
    expect(im.dormitorios).toBe(2)
    expect(im.area).toBe(39)
  })

  it('extrai o bairro da descrição', () => {
    expect(im.bairro).toBe('Petrópolis')
  })

  it('traz fotos em alta resolução', () => {
    expect(im.fotos.length).toBeGreaterThan(0)
    expect(im.fotos[0]).toContain('images.foxter.com.br')
  })

  it('prefixa o código com a fonte para não colidir entre portais', () => {
    expect(im.codigo_origem.startsWith('foxter-')).toBe(true)
  })

  it('devolve null para HTML sem os nós esperados', () => {
    expect(parseFoxter('<html></html>', 'x')).toBeNull()
  })
})

describe('Guarida', () => {
  const im = parseGuarida(
    htmlGuarida,
    'https://guarida.com.br/imovel/comprar/bom-fim-porto-alegre-rs/apartamento/5357'
  )!

  it('parseia o __NEXT_DATA__', () => {
    expect(im).not.toBeNull()
    expect(im.fonte).toBe('guarida')
    expect(im.codigo_origem).toBe('guarida-5357')
    expect(im.preco).toBe(930000)
    expect(im.condominio).toBe(1150)
    expect(im.iptu).toBe(1100)
  })

  it('lê as propriedades tipadas', () => {
    expect(im.dormitorios).toBe(3)
    expect(im.suites).toBe(1)
    expect(im.banheiros).toBe(2)
    expect(im.area).toBe(109)
  })

  it('traz geolocalização, que as outras fontes não têm', () => {
    expect(im.latitude).toBeCloseTo(-30.0351, 3)
    expect(im.longitude).toBeCloseTo(-51.211, 3)
  })

  it('pega o bairro do breadcrumb', () => {
    expect(im.bairro).toBe('Bom Fim')
  })

  it('traz a galeria completa ordenada', () => {
    expect(im.fotos.length).toBeGreaterThan(20)
    expect(im.fotos[0]).toContain('/pictures/')
  })

  it('devolve null quando não há imóvel no payload', () => {
    expect(parseGuarida('<html></html>', 'x')).toBeNull()
  })
})

describe('extração de ids', () => {
  it('Foxter devolve ids numéricos únicos', () => {
    const ids = idsFoxter('<a href="/imovel/161568">a</a><a href="/imovel/161568?modal=x">b</a>')
    expect(ids).toEqual(['161568'])
  })

  it('Guarida devolve o path inteiro, que carrega bairro e tipo', () => {
    const ids = idsGuarida(
      '<a href="/imovel/comprar/bom-fim-porto-alegre-rs/apartamento/5357">x</a>'
    )
    expect(ids).toEqual(['/imovel/comprar/bom-fim-porto-alegre-rs/apartamento/5357'])
  })
})
