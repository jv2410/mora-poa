import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto'
import { cookies } from 'next/headers'
import { getPool } from './db'

/**
 * `promisify(scrypt)` perde o overload que aceita opções de custo, então o
 * wrapper é escrito à mão. Sem ele, N/r/p seriam ignorados e o hash cairia no
 * custo padrão da biblioteca.
 */
function scrypt(
  senha: string,
  sal: Buffer,
  tamanho: number,
  opcoes: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(senha, sal, tamanho, opcoes, (erro, chave) =>
      erro ? reject(erro) : resolve(chave)
    )
  })
}

export const COOKIE = 'mora_sessao'
const DIAS_SESSAO = 30

export type Papel = 'corretor' | 'gerente' | 'diretor' | 'iara'

export type Usuario = {
  id: number
  conta_id: number
  nome: string
  email: string
  papel: Papel
  conta_nome: string
  comissao_pct: number
  mensalidade: number | null
  min_por_30_imoveis: number
}

/**
 * Parâmetros do scrypt. N=2^15 é o ponto em que uma verificação custa ~100ms
 * nesta classe de máquina: desconfortável para quem tenta força bruta e
 * imperceptível em um login.
 *
 * Ficam guardados junto do hash para que endurecer o custo no futuro não
 * invalide as senhas já existentes — a verificação lê os parâmetros com que
 * cada hash foi gerado.
 */
const CUSTO = { N: 32768, r: 8, p: 1, tamanho: 64 }

/**
 * O scrypt do Node recusa qualquer parâmetro que precise de mais de 32 MB, e
 * N=32768 com r=8 precisa de 128·N·r ≈ 33,5 MB — um byte acima do teto. Sem
 * elevar o limite explicitamente, toda chamada falha com "memory limit
 * exceeded" e o login nunca funciona.
 */
const MAXMEM = 128 * CUSTO.N * CUSTO.r * 2

export async function hashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16)
  const derivada = await scrypt(senha, sal, CUSTO.tamanho, {
    N: CUSTO.N,
    r: CUSTO.r,
    p: CUSTO.p,
    maxmem: MAXMEM,
  })
  return `scrypt$${CUSTO.N}$${CUSTO.r}$${CUSTO.p}$${sal.toString('base64')}$${derivada.toString('base64')}`
}

export async function conferirSenha(senha: string, guardado: string): Promise<boolean> {
  try {
    const [alg, N, r, p, salB64, hashB64] = guardado.split('$')
    if (alg !== 'scrypt') return false

    const esperado = Buffer.from(hashB64, 'base64')
    const derivada = await scrypt(senha, Buffer.from(salB64, 'base64'), esperado.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
      // Generoso de propósito: hashes antigos podem ter sido gerados com
      // parâmetros diferentes, e a verificação precisa conseguir reproduzi-los.
      maxmem: Math.max(MAXMEM, 128 * Number(N) * Number(r) * 2),
    })

    // Comparação em tempo constante: `===` vazaria, pelo tempo de resposta,
    // quantos bytes iniciais do hash o atacante acertou.
    return derivada.length === esperado.length && timingSafeEqual(derivada, esperado)
  } catch {
    return false
  }
}

/**
 * Cria a sessão e grava o cookie.
 *
 * O token é opaco e vive no banco, em vez de ser um JWT assinado: assim o
 * logout invalida de verdade, e não apenas apaga o cookie de um navegador.
 */
export async function abrirSessao(usuarioId: number): Promise<void> {
  const token = randomBytes(32).toString('base64url')
  const expira = new Date(Date.now() + DIAS_SESSAO * 86_400_000)

  await getPool().query(
    `INSERT INTO sessoes (token, usuario_id, expira_em) VALUES ($1, $2, $3)`,
    [token, usuarioId, expira]
  )
  await getPool().query(`UPDATE usuarios SET ultimo_acesso = now() WHERE id = $1`, [usuarioId])

  const jar = await cookies()
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expira,
  })
}

export async function fecharSessao(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (token) {
    await getPool().query(`DELETE FROM sessoes WHERE token = $1`, [token])
  }
  jar.delete(COOKIE)
}

/** O usuário da requisição atual, ou null. */
export async function usuarioAtual(): Promise<Usuario | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (!token) return null

  const { rows } = await getPool().query(
    `SELECT u.id, u.conta_id, u.nome, u.email, u.papel,
            c.nome conta_nome, c.comissao_pct, c.mensalidade, c.min_por_30_imoveis
     FROM sessoes s
     JOIN usuarios u ON u.id = s.usuario_id
     JOIN contas   c ON c.id = u.conta_id
     WHERE s.token = $1 AND s.expira_em > now()`,
    [token]
  )
  if (!rows[0]) return null

  return {
    ...rows[0],
    comissao_pct: Number(rows[0].comissao_pct),
    mensalidade: rows[0].mensalidade == null ? null : Number(rows[0].mensalidade),
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Cria a conta da imobiliária e o seu primeiro usuário, que nasce diretor —
 * quem cadastra é quem assina.
 */
export async function criarConta(args: {
  imobiliaria: string
  nome: string
  email: string
  senha: string
  mensalidade?: number | null
}): Promise<{ ok: true; usuarioId: number } | { ok: false; motivo: string }> {
  const email = args.email.trim().toLowerCase()
  if (!EMAIL.test(email)) return { ok: false, motivo: 'E-mail inválido.' }
  if (args.senha.length < 8) {
    return { ok: false, motivo: 'A senha precisa de ao menos 8 caracteres.' }
  }
  if (!args.imobiliaria.trim() || !args.nome.trim()) {
    return { ok: false, motivo: 'Informe o seu nome e o da imobiliária.' }
  }

  const pool = getPool()
  const cliente = await pool.connect()
  try {
    await cliente.query('BEGIN')

    const { rows: jaTem } = await cliente.query(`SELECT 1 FROM usuarios WHERE email = $1`, [email])
    if (jaTem[0]) {
      await cliente.query('ROLLBACK')
      return { ok: false, motivo: 'Já existe conta com esse e-mail.' }
    }

    const { rows: conta } = await cliente.query(
      `INSERT INTO contas (nome, mensalidade) VALUES ($1, $2) RETURNING id`,
      [args.imobiliaria.trim(), args.mensalidade ?? null]
    )

    const { rows: usuario } = await cliente.query(
      `INSERT INTO usuarios (conta_id, nome, email, senha_hash, papel)
       VALUES ($1, $2, $3, $4, 'diretor') RETURNING id`,
      [conta[0].id, args.nome.trim(), email, await hashSenha(args.senha)]
    )

    await cliente.query('COMMIT')
    return { ok: true, usuarioId: usuario[0].id }
  } catch {
    await cliente.query('ROLLBACK')
    return { ok: false, motivo: 'Não foi possível criar a conta.' }
  } finally {
    cliente.release()
  }
}

export async function entrar(
  email: string,
  senha: string
): Promise<{ ok: true; usuarioId: number } | { ok: false; motivo: string }> {
  const { rows } = await getPool().query(
    `SELECT id, senha_hash FROM usuarios WHERE email = $1`,
    [email.trim().toLowerCase()]
  )

  // Mesma mensagem para e-mail inexistente e senha errada: dizer qual dos dois
  // falhou entrega ao atacante a lista de quem tem conta.
  const generico = { ok: false as const, motivo: 'E-mail ou senha incorretos.' }
  if (!rows[0]) {
    // Gasta o mesmo tempo de uma verificação real, para a ausência de conta não
    // se revelar por resposta instantânea.
    await hashSenha(senha)
    return generico
  }

  const confere = await conferirSenha(senha, rows[0].senha_hash)
  return confere ? { ok: true, usuarioId: rows[0].id } : generico
}

/**
 * Reivindica para o usuário as buscas e seleções feitas anonimamente neste
 * navegador. É o que impede o histórico de antes do login de virar órfão.
 */
export async function reivindicarHistorico(
  usuarioId: number,
  corretorId: string
): Promise<void> {
  if (!/^[a-z0-9-]{8,64}$/i.test(corretorId)) return

  await getPool().query(
    `INSERT INTO corretor_ids (corretor_id, usuario_id) VALUES ($1, $2)
     ON CONFLICT (corretor_id) DO NOTHING`,
    [corretorId, usuarioId]
  )
  // Preenche apenas onde ainda está vazio: nunca reatribui histórico que já
  // pertence a alguém.
  await getPool().query(
    `UPDATE buscas SET usuario_id = $2 WHERE corretor_id = $1 AND usuario_id IS NULL`,
    [corretorId, usuarioId]
  )
  await getPool().query(
    `UPDATE selecoes SET usuario_id = $2 WHERE corretor_id = $1 AND usuario_id IS NULL`,
    [corretorId, usuarioId]
  )
}

/** Papéis que podem ver cada painel. */
export const VE_EQUIPE: Papel[] = ['gerente', 'diretor', 'iara']
export const VE_DIRETORIA: Papel[] = ['diretor', 'iara']
