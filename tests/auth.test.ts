import { describe, it, expect } from 'vitest'
import { hashSenha, conferirSenha } from '@/lib/auth'

describe('hash de senha', () => {
  it('não guarda a senha em texto', async () => {
    const h = await hashSenha('senha-secreta-123')
    expect(h).not.toContain('senha-secreta-123')
    expect(h.startsWith('scrypt$')).toBe(true)
  })

  it('aceita a senha certa e recusa a errada', async () => {
    const h = await hashSenha('abacaxi-com-hortela')
    expect(await conferirSenha('abacaxi-com-hortela', h)).toBe(true)
    expect(await conferirSenha('abacaxi-com-hortela ', h)).toBe(false)
    expect(await conferirSenha('Abacaxi-com-hortela', h)).toBe(false)
    expect(await conferirSenha('', h)).toBe(false)
  })

  it('a mesma senha gera hashes diferentes', async () => {
    // Sal aleatório por hash: duas contas com a mesma senha não podem ter o
    // mesmo registro, senão um vazamento revela quem compartilha senha.
    const a = await hashSenha('repetida')
    const b = await hashSenha('repetida')
    expect(a).not.toBe(b)
    expect(await conferirSenha('repetida', a)).toBe(true)
    expect(await conferirSenha('repetida', b)).toBe(true)
  })

  it('guarda os parâmetros de custo junto do hash', async () => {
    // É o que permite endurecer o custo depois sem invalidar senha nenhuma.
    const [alg, N, r, p] = (await hashSenha('x')).split('$')
    expect(alg).toBe('scrypt')
    expect(Number(N)).toBeGreaterThanOrEqual(16384)
    expect(Number(r)).toBeGreaterThan(0)
    expect(Number(p)).toBeGreaterThan(0)
  })

  it('verifica com o custo gravado, não com o atual', async () => {
    // Hash forjado com N menor: precisa continuar validando, senão um aumento
    // de custo trancaria todos os usuários antigos fora da conta.
    const { scrypt } = await import('node:crypto')
    const sal = Buffer.from('0123456789abcdef')
    const derivada: Buffer = await new Promise((res, rej) =>
      scrypt('antiga', sal, 64, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? rej(e) : res(k)))
    )
    const guardado = `scrypt$16384$8$1$${sal.toString('base64')}$${derivada.toString('base64')}`
    expect(await conferirSenha('antiga', guardado)).toBe(true)
    expect(await conferirSenha('outra', guardado)).toBe(false)
  })

  it('hash corrompido devolve false em vez de estourar', async () => {
    for (const ruim of ['', 'lixo', 'scrypt$', 'scrypt$a$b$c$d$e', 'bcrypt$1$2$3$4$5']) {
      expect(await conferirSenha('qualquer', ruim)).toBe(false)
    }
  })
})
