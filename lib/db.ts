import { Pool } from 'pg'
import type { Imovel, Criterios } from './tipos'

// Tabela de transliteração para comparar bairros ignorando acento.
const ACENTOS = `'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ'`
const SEM_ACENTOS = `'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'`

let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return pool
}

export async function inserirImovel(im: Imovel): Promise<void> {
  await getPool().query(
    `INSERT INTO imoveis (
       codigo_origem, url_origem, titulo, descricao, preco, condominio, iptu,
       area, dormitorios, suites, banheiros, vagas, bairro, endereco, cidade,
       fotos, corretor_nome, corretor_telefone, publicado_em, dados_conflitantes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
     ON CONFLICT (codigo_origem) DO NOTHING`,
    [im.codigo_origem, im.url_origem, im.titulo, im.descricao, im.preco,
     im.condominio, im.iptu, im.area, im.dormitorios, im.suites, im.banheiros,
     im.vagas, im.bairro, im.endereco, im.cidade, im.fotos, im.corretor_nome,
     im.corretor_telefone, im.publicado_em, im.dados_conflitantes]
  )
}

/** Converte os NUMERIC do pg (que vêm como string) para number. */
function normalizar(row: any): Imovel {
  const num = (v: unknown) => (v == null ? null : Number(v))
  return {
    ...row,
    preco: Number(row.preco),
    condominio: num(row.condominio),
    iptu: num(row.iptu),
    area: num(row.area),
    preco_m2: num(row.preco_m2),
    custo_mensal: num(row.custo_mensal),
    fotos: row.fotos ?? [],
  }
}

export async function buscar(c: Criterios, limite = 20): Promise<Imovel[]> {
  const cond: string[] = []
  const vals: unknown[] = []
  const add = (sql: string, v: unknown) => {
    vals.push(v)
    cond.push(sql.replace('?', `$${vals.length}`))
  }

  if (c.preco_max != null) add('preco <= ?', c.preco_max)
  if (c.preco_min != null) add('preco >= ?', c.preco_min)
  if (c.dorm_min != null) add('dormitorios >= ?', c.dorm_min)
  if (c.vagas_min != null) add('vagas >= ?', c.vagas_min)
  if (c.area_min != null) add('area >= ?', c.area_min)
  if (c.custo_mensal_max != null) add('custo_mensal <= ?', c.custo_mensal_max)
  if (c.bairros?.length) {
    // translate() é nativo e imutável — evita depender da extensão unaccent.
    add(
      `lower(translate(bairro, ${ACENTOS}, ${SEM_ACENTOS})) = ANY(?)`,
      c.bairros.map((b) => semAcento(b.toLowerCase()))
    )
  }

  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : ''
  vals.push(limite)
  const { rows } = await getPool().query(
    `SELECT * FROM imoveis ${where} ORDER BY preco ASC LIMIT $${vals.length}`,
    vals
  )
  return rows.map(normalizar)
}

export async function porId(id: number): Promise<Imovel | null> {
  const { rows } = await getPool().query('SELECT * FROM imoveis WHERE id = $1', [id])
  return rows[0] ? normalizar(rows[0]) : null
}

export async function porIds(ids: number[]): Promise<Imovel[]> {
  const { rows } = await getPool().query('SELECT * FROM imoveis WHERE id = ANY($1)', [ids])
  return rows.map(normalizar)
}

export async function todos(limite = 100): Promise<Imovel[]> {
  const { rows } = await getPool().query(
    'SELECT * FROM imoveis ORDER BY preco ASC LIMIT $1',
    [limite]
  )
  return rows.map(normalizar)
}

export function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}
