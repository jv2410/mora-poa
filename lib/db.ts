import { Pool } from 'pg'
import type { Imovel, Criterios } from './tipos'

// Tabela de transliteração para comparar bairros ignorando acento.
const ACENTOS = `'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ'`
const SEM_ACENTOS = `'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'`

/**
 * O mesmo apartamento é anunciado em mais de um portal — Zap e VivaReal são do
 * mesmo grupo e compartilham a base inteira. Sem isto a IA recomenda "dois"
 * imóveis que são um só, e o usuário perde a confiança na lista.
 *
 * Dedupe por preço + área + dormitórios + bairro: quatro campos iguais em dois
 * anúncios da mesma cidade é o mesmo imóvel na prática. Entre as cópias fica a
 * com mais fotos, depois a com descrição, depois a com geolocalização — ou
 * seja, a versão mais informativa, venha do portal que vier.
 */
const SEM_DUPLICATAS = `
  WITH unicos AS (
    SELECT DISTINCT ON (preco, area, dormitorios, bairro) *
    FROM imoveis
    WHERE true`

const ORDEM_QUALIDADE = `
    ORDER BY preco, area, dormitorios, bairro,
             coalesce(array_length(fotos, 1), 0) DESC,
             (descricao IS NOT NULL) DESC,
             (latitude IS NOT NULL) DESC`

let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return pool
}

export async function inserirImovel(im: Imovel): Promise<void> {
  await getPool().query(
    `INSERT INTO imoveis (
       fonte, codigo_origem, url_origem, titulo, descricao, preco, condominio,
       iptu, area, area_total, dormitorios, suites, banheiros, vagas, bairro,
       endereco, cidade, latitude, longitude, caracteristicas, fotos,
       corretor_nome, corretor_telefone, publicado_em, dados_conflitantes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
               $19,$20,$21,$22,$23,$24,$25)
     ON CONFLICT (codigo_origem) DO NOTHING`,
    [im.fonte, im.codigo_origem, im.url_origem, im.titulo, im.descricao, im.preco,
     im.condominio, im.iptu, im.area, im.area_total, im.dormitorios, im.suites,
     im.banheiros, im.vagas, im.bairro, im.endereco, im.cidade, im.latitude,
     im.longitude, im.caracteristicas, im.fotos, im.corretor_nome,
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
    area_total: num(row.area_total),
    preco_m2: num(row.preco_m2),
    custo_mensal: num(row.custo_mensal),
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    fotos: row.fotos ?? [],
    caracteristicas: row.caracteristicas ?? [],
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
    `${SEM_DUPLICATAS} ${where ? where.replace('WHERE', 'AND') : ''}
     ${ORDEM_QUALIDADE}
     ) SELECT * FROM unicos ORDER BY preco ASC LIMIT $${vals.length}`,
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
    `${SEM_DUPLICATAS} ${ORDEM_QUALIDADE})
     SELECT * FROM unicos ORDER BY preco ASC LIMIT $1`,
    [limite]
  )
  return rows.map(normalizar)
}

/** Quantos imóveis distintos existem, já descontadas as duplicatas. */
export async function contarUnicos(): Promise<number> {
  const { rows } = await getPool().query(
    `${SEM_DUPLICATAS} ${ORDEM_QUALIDADE}) SELECT count(*)::int n FROM unicos`
  )
  return rows[0].n
}

export function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}
