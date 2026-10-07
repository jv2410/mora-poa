import { describe, it, expect } from 'vitest'
import {
  criarSelecao, marcarEnviada, porToken, registrarAbertura,
  registrarVisualizacaoItem, responder, doCorretor, registrarBusca,
} from '@/lib/selecao'
import { todos } from '@/lib/db'

const corretor = `teste-${Math.random().toString(36).slice(2, 10)}`

async function doisImoveis() {
  const lista = await todos(2)
  expect(lista.length).toBe(2)
  return lista.map((im, i) => ({
    imovel_id: im.id!,
    faixa: (i === 0 ? 'alta' : 'ressalva') as 'alta' | 'ressalva',
    ressalva: i === 0 ? null : 'Atende tudo, exceto a vaga',
  }))
}

describe('funil da seleção', () => {
  it('percorre a sequência de status do documento', async () => {
    const itens = await doisImoveis()
    const token = await criarSelecao({ corretorId: corretor, cliente: 'Ana Paula', itens })

    // 1. aprovado pelo corretor
    let sel = (await porToken(token))!
    expect(sel.itens).toHaveLength(2)
    expect(sel.itens.every((i) => i.status === 'aprovado_corretor')).toBe(true)

    // 2. enviado
    await marcarEnviada(token)
    sel = (await porToken(token))!
    expect(sel.itens.every((i) => i.status === 'enviado')).toBe(true)
    expect(sel.enviada_em).toBeTruthy()

    // 3. visualizado (o comprador abriu o link)
    await registrarAbertura(token)
    sel = (await porToken(token))!
    expect(sel.aberturas).toBe(1)
    expect(sel.itens.every((i) => i.status === 'visualizado')).toBe(true)

    // 4. aprovado pelo comprador / recusado com motivo
    await responder(token, itens[0].imovel_id, 'quero_visitar')
    await responder(token, itens[1].imovel_id, 'nao_e_pra_mim', 'preco')
    sel = (await porToken(token))!

    const aprovado = sel.itens.find((i) => i.imovel_id === itens[0].imovel_id)!
    const recusado = sel.itens.find((i) => i.imovel_id === itens[1].imovel_id)!
    expect(aprovado.status).toBe('aprovado_comprador')
    expect(recusado.status).toBe('recusado')
    expect(recusado.motivo_recusa).toBe('preco')
  })

  it('congela a faixa e a ressalva no momento do envio', async () => {
    const itens = await doisImoveis()
    const token = await criarSelecao({ corretorId: corretor, itens })
    const sel = (await porToken(token))!
    const comRessalva = sel.itens.find((i) => i.faixa === 'ressalva')!
    // O que o comprador leu precisa continuar sendo o que ele leu, mesmo que o
    // imóvel mude de faixa numa busca futura.
    expect(comRessalva.ressalva).toBe('Atende tudo, exceto a vaga')
  })

  it('alta compatibilidade vem antes na página do comprador', async () => {
    const itens = await doisImoveis()
    const token = await criarSelecao({ corretorId: corretor, itens })
    const sel = (await porToken(token))!
    expect(sel.itens[0].faixa).toBe('alta')
  })

  it('conta cada abertura e cada visualização de imóvel', async () => {
    const itens = await doisImoveis()
    const token = await criarSelecao({ corretorId: corretor, itens })

    await registrarAbertura(token)
    await registrarAbertura(token)
    await registrarVisualizacaoItem(token, itens[0].imovel_id)
    await registrarVisualizacaoItem(token, itens[0].imovel_id)
    await registrarVisualizacaoItem(token, itens[0].imovel_id)

    const sel = (await porToken(token))!
    expect(sel.aberturas).toBe(2)
    const visto = sel.itens.find((i) => i.imovel_id === itens[0].imovel_id)!
    // É o número que produz o alerta "abriu 3 vezes e não respondeu".
    expect(visto.visualizacoes).toBe(3)
    expect(visto.status).not.toBe('aprovado_comprador')
  })

  it('token inexistente devolve null em vez de estourar', async () => {
    expect(await porToken('nao-existe-esse-token')).toBeNull()
  })

  it('o token não é adivinhável por tentativa', async () => {
    const itens = await doisImoveis()
    const a = await criarSelecao({ corretorId: corretor, itens })
    const b = await criarSelecao({ corretorId: corretor, itens })
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThanOrEqual(32)
  })

  it('o corretor reencontra as seleções que mandou, com o andamento', async () => {
    const itens = await doisImoveis()
    const token = await criarSelecao({ corretorId: corretor, cliente: 'Roberto', itens })
    await responder(token, itens[0].imovel_id, 'quero_visitar')

    const lista = await doCorretor(corretor)
    const minha = lista.find((s: any) => s.token === token)!
    expect(minha.cliente).toBe('Roberto')
    expect(minha.total).toBe(2)
    expect(minha.aprovados).toBe(1)
  })
})

describe('registro de buscas', () => {
  it('grava a busca com os critérios e as contagens por faixa', async () => {
    const id = await registrarBusca({
      corretorId: corretor,
      briefing: 'casal com bebê, Menino Deus, 3 dorm',
      criterios: { dorm_min: 3, preco_max: 750_000, bairros: ['Menino Deus'] },
      alta: 0,
      valeApresentar: 4,
    })
    expect(id).toBeTypeOf('number')
  })

  it('falha de telemetria não derruba a busca', async () => {
    // criterios com referência circular: o JSON.stringify estoura dentro da
    // função, e ela precisa devolver null em vez de propagar.
    const circular: any = {}
    circular.eu = circular
    const id = await registrarBusca({
      corretorId: corretor, briefing: null, criterios: circular, alta: 1, valeApresentar: 1,
    })
    expect(id).toBeNull()
  })
})
