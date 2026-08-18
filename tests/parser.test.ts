import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { parsearImovel, extrairIdsDaListagem } from '@/lib/parser'

const html = readFileSync('tests/fixtures/imovel-484012.html', 'utf-8')
const listagem = readFileSync('tests/fixtures/listagem-poa.html', 'utf-8')

describe('parsearImovel', () => {
  const im = parsearImovel(html, 'https://www.auxiliadorapredial.com.br/imovel/venda/484012')!

  it('extrai identificação e preços', () => {
    expect(im.codigo_origem).toBe('484012')
    expect(im.preco).toBe(575000)
    expect(im.condominio).toBe(1003.9)
    expect(im.iptu).toBe(1500)
  })

  it('extrai bairro e endereço', () => {
    expect(im.bairro).toBe('Centro Histórico')
    expect(im.endereco).toBe('Rua Duque de Caxias 581')
    expect(im.cidade).toBe('Porto Alegre')
  })

  it('extrai características do JSON-LD', () => {
    expect(im.vagas).toBe(1)
    expect(im.suites).toBe(0)
    expect(im.banheiros).toBe(1)
  })

  it('prefere o título quando ele contradiz o JSON-LD', () => {
    // JSON-LD diz numberOfRooms: 1 e floorSize: 120.96;
    // o título do mesmo anúncio diz "2 quartos e 78m²". O título vence.
    expect(im.dormitorios).toBe(2)
    expect(im.area).toBe(78)
    expect(im.dados_conflitantes).toBe(true)
  })

  it('extrai as fotos em alta resolução', () => {
    expect(im.fotos.length).toBeGreaterThanOrEqual(10)
    expect(im.fotos[0]).toContain('img.auxiliadorapredial.com.br')
    expect(im.fotos[0]).toContain('/thumb/1920/')
  })

  it('extrai o corretor', () => {
    expect(im.corretor_nome).toBe('Lilian Matoso')
    expect(im.corretor_telefone).toBe('555132166184')
  })

  it('devolve null para HTML sem JSON-LD de imóvel', () => {
    expect(parsearImovel('<html><body>nada aqui</body></html>', 'x')).toBeNull()
  })
})

describe('extrairIdsDaListagem', () => {
  it('extrai IDs únicos de venda', () => {
    const ids = extrairIdsDaListagem(listagem)
    expect(ids.length).toBeGreaterThan(15)
    expect(ids).toContain('484012')
    expect(new Set(ids).size).toBe(ids.length)
  })
})
