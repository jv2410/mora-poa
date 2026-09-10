import { describe, it, expect } from 'vitest'
import { buscar, porId, porIds, todos } from '@/lib/db'
import { executarTool } from '@/lib/tools'

/**
 * O banco ainda guarda corretor_nome e corretor_telefone em linhas coletadas
 * antes desta regra — dado histórico não se apaga. O que estes testes garantem
 * é que nenhum caminho de leitura devolve esses campos, hoje ou depois de um
 * refactor. É a única barreira automatizada entre a coluna e a resposta HTTP.
 */
const PROIBIDOS = ['corretor_nome', 'corretor_telefone']

function semContato(obj: unknown, onde: string) {
  const chaves = Object.keys((obj ?? {}) as object)
  for (const p of PROIBIDOS) {
    expect(chaves, `${onde} vazou ${p}`).not.toContain(p)
  }
}

describe('dados pessoais do anunciante', () => {
  it('não saem de buscar()', async () => {
    const r = await buscar({ preco_max: 900_000 }, 5)
    expect(r.length).toBeGreaterThan(0)
    r.forEach((im, i) => semContato(im, `buscar()[${i}]`))
  })

  it('não saem de todos()', async () => {
    const r = await todos(5)
    expect(r.length).toBeGreaterThan(0)
    r.forEach((im, i) => semContato(im, `todos()[${i}]`))
  })

  it('não saem de porId() nem de porIds()', async () => {
    const [primeiro] = await todos(1)
    semContato(await porId(primeiro.id!), 'porId()')
    const varios = await porIds([primeiro.id!])
    varios.forEach((im, i) => semContato(im, `porIds()[${i}]`))
  })

  it('não saem de nenhuma tool que o modelo pode chamar', async () => {
    const { imoveis } = await executarTool('buscar_imoveis', { preco_max: 900_000 })
    imoveis.forEach((im: unknown, i: number) => semContato(im, `buscar_imoveis[${i}]`))

    const ficha = await executarTool('detalhar_imovel', { id: imoveis[0].id })
    semContato(ficha.imovel, 'detalhar_imovel')

    const comp = await executarTool('comparar_imoveis', {
      ids: imoveis.slice(0, 2).map((i: any) => i.id),
    })
    comp.imoveis.forEach((im: unknown, i: number) => semContato(im, `comparar_imoveis[${i}]`))
  })

  it('o texto serializado que vai para o modelo não contém telefone brasileiro', async () => {
    const { imoveis } = await executarTool('buscar_imoveis', { preco_max: 900_000 })
    const bruto = JSON.stringify(imoveis)
    // +55DDNNNNNNNNN ou (51) 9999-9999 — os formatos que os portais publicam.
    expect(bruto).not.toMatch(/\+55\d{10,11}/)
    expect(bruto).not.toMatch(/\(\d{2}\)\s?\d{4,5}-\d{4}/)
  })
})
