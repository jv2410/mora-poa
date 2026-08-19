import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { parsearImovel, extrairIdsDaListagem, normalizarBairro } from '@/lib/fontes/auxiliadora'

const html = readFileSync('tests/fixtures/imovel-484012.html', 'utf-8')
const listagem = readFileSync('tests/fixtures/listagem-poa.html', 'utf-8')

describe('parsearImovel', () => {
  const im = parsearImovel(html, 'https://www.auxiliadorapredial.com.br/imovel/venda/484012')!

  it('extrai identificação e preços', () => {
    // Prefixado com a fonte: nada impede a Foxter e a Auxiliadora de terem
    // anúncios com o mesmo número, e a coluna é UNIQUE.
    expect(im.codigo_origem).toBe('auxiliadora-484012')
    expect(im.fonte).toBe('auxiliadora')
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

  it('usa o título como área privativa e o JSON-LD como área total', () => {
    // JSON-LD diz numberOfRooms: 1 e floorSize: 120.96 (área total);
    // o título diz "2 quartos e 78m²" (área privativa, contando a suíte).
    // As duas fontes estão certas — medem coisas diferentes.
    expect(im.dormitorios).toBe(2)
    expect(im.area).toBe(78)
    expect(im.area_total).toBe(120.96)
  })

  it('não marca conflito para a diferença semântica entre as fontes', () => {
    // Área total > privativa e JSON-LD com menos quartos é o padrão normal
    // do portal, não anomalia. Marcar isso como conflito ligaria o alerta em
    // 95% do banco e o aviso deixaria de significar qualquer coisa.
    expect(im.dados_conflitantes).toBe(false)
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

describe('normalizarBairro', () => {
  it('unifica caixas divergentes do portal', () => {
    expect(normalizarBairro('BOM FIM')).toBe('Bom Fim')
    expect(normalizarBairro('Bom Fim')).toBe('Bom Fim')
    expect(normalizarBairro('bom fim')).toBe('Bom Fim')
  })

  it('mantém minúsculas nas palavras de ligação', () => {
    expect(normalizarBairro('MOINHOS DE VENTO')).toBe('Moinhos de Vento')
    expect(normalizarBairro('praia de belas')).toBe('Praia de Belas')
  })

  it('preserva acento', () => {
    expect(normalizarBairro('PETRÓPOLIS')).toBe('Petrópolis')
    expect(normalizarBairro('centro histórico')).toBe('Centro Histórico')
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
