# Plataforma de Imóveis com IA Conversacional — Plano de Implementação

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir uma plataforma onde a pessoa conversa com uma IA em linguagem natural e recebe, ranqueados e justificados, os melhores imóveis de um banco de 100 apartamentos à venda em Porto Alegre coletados da Auxiliadora Predial.

**Architecture:** Um script de ingestão popula um Postgres local a partir do JSON-LD das páginas públicas do portal. O chat usa `claude-opus-5` com três tools que consultam esse banco por SQL parametrizado; o ranking é calculado por uma função pura em TypeScript e apenas *narrado* pelo modelo, de forma que nenhum número exibido seja gerado por LLM. O front é Next.js 15 com CSS puro clonando o design system do iaraautomacoes.com.br, e o chat vive num painel lateral fixo com os resultados aparecendo em tempo real ao lado.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Postgres 16 (Docker Compose), `pg`, `@anthropic-ai/sdk`, Vitest, CSS puro.

**Spec:** `docs/superpowers/specs/2026-08-18-plataforma-imoveis-ia-design.md`

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `docker-compose.yml` | Postgres 16 local |
| `db/schema.sql` | DDL da tabela `imoveis` (aditivo apenas) |
| `lib/tipos.ts` | Tipo `Imovel` e `Criterios`, compartilhados por todo o resto |
| `lib/parser.ts` | HTML de um anúncio → `Imovel`. Cruza JSON-LD com o título |
| `lib/db.ts` | Pool de conexão e queries SQL |
| `scripts/coletar.ts` | Descobre IDs por bairro, busca cada anúncio, grava no banco |
| `lib/score.ts` | Função pura de ranking |
| `lib/tools.ts` | Definição e execução das 3 tools |
| `lib/claude.ts` | Cliente Anthropic e loop de tool use com streaming |
| `app/api/chat/route.ts` | Endpoint SSE |
| `styles/system.css` | Tokens e componentes do design system |
| `app/page.tsx`, `app/imoveis/page.tsx`, `app/imovel/[id]/page.tsx` | Páginas |
| `components/ChatPanel.tsx` | Painel lateral fixo |
| `components/CardImovel.tsx` | Card de imóvel (usado na vitrine e no chat) |

Cada módulo em `lib/` tem uma responsabilidade única e é testável isoladamente. `parser.ts` e `score.ts` são funções puras — é onde os testes concentram esforço, porque é onde o erro é caro e silencioso.

---

## Task 1: Scaffold do projeto

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `docker-compose.yml`, `.env.local`, `.gitignore`, `app/layout.tsx`, `app/page.tsx`

- [ ] **Step 1: Inicializar o projeto Next.js**

```bash
cd /Users/macos/imoveis-ia-rs
npx create-next-app@latest . --typescript --app --no-tailwind --no-eslint --no-src-dir --import-alias "@/*" --yes
```

Se o `create-next-app` reclamar de diretório não vazio, responda que sim para prosseguir — `docs/` e `tests/fixtures/` devem ser preservados. Confirme depois com `ls docs tests/fixtures`.

- [ ] **Step 2: Instalar as dependências restantes**

```bash
npm install pg @anthropic-ai/sdk
npm install -D vitest @types/pg tsx
```

- [ ] **Step 3: Configurar o Vitest**

Criar `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
})
```

Adicionar em `package.json`, dentro de `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest",
"coletar": "tsx scripts/coletar.ts"
```

- [ ] **Step 4: Subir o Postgres**

Criar `docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: imoveis-db
    environment:
      POSTGRES_USER: imoveis
      POSTGRES_PASSWORD: imoveis
      POSTGRES_DB: imoveis
    ports:
      - "5433:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

Porta 5433 no host para não colidir com um Postgres já instalado localmente.

Criar `.env.local`:

```
DATABASE_URL=postgresql://imoveis:imoveis@localhost:5433/imoveis
ANTHROPIC_API_KEY=
```

Adicionar `.env.local` ao `.gitignore` (o `create-next-app` já inclui `.env*`, confirme).

Run: `docker compose up -d && sleep 5 && docker compose ps`
Expected: container `imoveis-db` com status `running`/`healthy`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 + Postgres + Vitest"
```

---

## Task 2: Schema e camada de banco

**Files:**
- Create: `db/schema.sql`, `lib/tipos.ts`, `lib/db.ts`

- [ ] **Step 1: Escrever o schema**

Criar `db/schema.sql` exatamente como especificado no spec (seção 2). Apenas comandos aditivos — `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`. Nenhum `DROP`, `DELETE`, `TRUNCATE` ou `UPDATE`.

```sql
CREATE TABLE IF NOT EXISTS imoveis (
  id                  SERIAL PRIMARY KEY,
  codigo_origem       TEXT UNIQUE NOT NULL,
  url_origem          TEXT NOT NULL,
  titulo              TEXT NOT NULL,
  descricao           TEXT,
  preco               NUMERIC(12,2) NOT NULL,
  condominio          NUMERIC(10,2),
  iptu                NUMERIC(10,2),
  area                NUMERIC(8,2),
  dormitorios         SMALLINT,
  suites              SMALLINT,
  banheiros           SMALLINT,
  vagas               SMALLINT,
  bairro              TEXT NOT NULL,
  endereco            TEXT,
  cidade              TEXT NOT NULL DEFAULT 'Porto Alegre',
  fotos               TEXT[],
  corretor_nome       TEXT,
  corretor_telefone   TEXT,
  publicado_em        TIMESTAMPTZ,
  coletado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  dados_conflitantes  BOOLEAN NOT NULL DEFAULT false,
  preco_m2      NUMERIC(10,2) GENERATED ALWAYS AS
                (CASE WHEN area > 0 THEN preco / area END) STORED,
  custo_mensal  NUMERIC(10,2) GENERATED ALWAYS AS
                (COALESCE(condominio,0) + COALESCE(iptu,0)/12) STORED
);

CREATE INDEX IF NOT EXISTS idx_imoveis_preco       ON imoveis (preco);
CREATE INDEX IF NOT EXISTS idx_imoveis_bairro      ON imoveis (bairro);
CREATE INDEX IF NOT EXISTS idx_imoveis_dormitorios ON imoveis (dormitorios);
```

- [ ] **Step 2: Aplicar o schema**

Run: `docker compose exec -T db psql -U imoveis -d imoveis < db/schema.sql`
Depois: `docker compose exec db psql -U imoveis -d imoveis -c "\d imoveis"`
Expected: a tabela listada com todas as colunas, `preco_m2` e `custo_mensal` marcadas como `generated always as ... stored`.

- [ ] **Step 3: Definir os tipos**

Criar `lib/tipos.ts`:

```typescript
export type Imovel = {
  id?: number
  codigo_origem: string
  url_origem: string
  titulo: string
  descricao: string | null
  preco: number
  condominio: number | null
  iptu: number | null
  area: number | null
  dormitorios: number | null
  suites: number | null
  banheiros: number | null
  vagas: number | null
  bairro: string
  endereco: string | null
  cidade: string
  fotos: string[]
  corretor_nome: string | null
  corretor_telefone: string | null
  publicado_em: string | null
  dados_conflitantes: boolean
  preco_m2?: number | null
  custo_mensal?: number | null
}

export type Criterios = {
  preco_max?: number
  preco_min?: number
  bairros?: string[]
  dorm_min?: number
  vagas_min?: number
  area_min?: number
  custo_mensal_max?: number
}

export type ImovelComScore = Imovel & {
  score: number
  atende: string[]
  nao_atende: string[]
}
```

- [ ] **Step 4: Escrever a camada de banco**

Criar `lib/db.ts`:

```typescript
import { Pool } from 'pg'
import type { Imovel, Criterios } from './tipos'

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

export async function buscar(c: Criterios, limite = 20): Promise<Imovel[]> {
  const cond: string[] = []
  const vals: unknown[] = []
  const add = (sql: string, v: unknown) => { vals.push(v); cond.push(sql.replace('?', `$${vals.length}`)) }

  if (c.preco_max        != null) add('preco <= ?', c.preco_max)
  if (c.preco_min        != null) add('preco >= ?', c.preco_min)
  if (c.dorm_min         != null) add('dormitorios >= ?', c.dorm_min)
  if (c.vagas_min        != null) add('vagas >= ?', c.vagas_min)
  if (c.area_min         != null) add('area >= ?', c.area_min)
  if (c.custo_mensal_max != null) add('custo_mensal <= ?', c.custo_mensal_max)
  if (c.bairros?.length)          add('lower(bairro) = ANY(?)', c.bairros.map(b => b.toLowerCase()))

  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : ''
  vals.push(limite)
  const { rows } = await getPool().query(
    `SELECT * FROM imoveis ${where} ORDER BY preco ASC LIMIT $${vals.length}`, vals
  )
  return rows
}

export async function porId(id: number): Promise<Imovel | null> {
  const { rows } = await getPool().query('SELECT * FROM imoveis WHERE id = $1', [id])
  return rows[0] ?? null
}

export async function porIds(ids: number[]): Promise<Imovel[]> {
  const { rows } = await getPool().query('SELECT * FROM imoveis WHERE id = ANY($1)', [ids])
  return rows
}

export async function todos(limite = 100): Promise<Imovel[]> {
  const { rows } = await getPool().query('SELECT * FROM imoveis ORDER BY preco ASC LIMIT $1', [limite])
  return rows
}
```

Toda query é parametrizada. Nenhuma interpolação de string em SQL.

- [ ] **Step 5: Commit**

```bash
git add db lib/tipos.ts lib/db.ts
git commit -m "feat: schema do banco e camada de acesso"
```

---

## Task 3: Parser (TDD)

Este é o módulo mais importante do plano. A fixture `tests/fixtures/imovel-484012.html` é HTML real capturado do portal em 2026-08-18, e contém a contradição descrita no spec: o JSON-LD diz `numberOfRooms: 1` e `floorSize: 120.96`, o título do mesmo anúncio diz "2 quartos e 78m²".

**Files:**
- Create: `lib/parser.ts`, `tests/parser.test.ts`
- Fixture (já existe): `tests/fixtures/imovel-484012.html`

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { parsearImovel, extrairIdsDaListagem } from '@/lib/parser'

const html = readFileSync('tests/fixtures/imovel-484012.html', 'utf-8')
const listagem = readFileSync('tests/fixtures/listagem-poa.html', 'utf-8')

describe('parsearImovel', () => {
  const im = parsearImovel(html, 'https://www.auxiliadorapredial.com.br/imovel/venda/484012')

  it('extrai identificação e preços', () => {
    expect(im!.codigo_origem).toBe('484012')
    expect(im!.preco).toBe(575000)
    expect(im!.condominio).toBe(1003.9)
    expect(im!.iptu).toBe(1500)
  })

  it('extrai bairro e endereço', () => {
    expect(im!.bairro).toBe('Centro Histórico')
    expect(im!.endereco).toBe('Rua Duque de Caxias 581')
    expect(im!.cidade).toBe('Porto Alegre')
  })

  it('extrai características do JSON-LD', () => {
    expect(im!.vagas).toBe(1)
    expect(im!.suites).toBe(0)
    expect(im!.banheiros).toBe(1)
  })

  it('prefere o título quando ele contradiz o JSON-LD', () => {
    // JSON-LD diz numberOfRooms: 1 e floorSize: 120.96;
    // o título diz "2 quartos e 78m²". O título vence.
    expect(im!.dormitorios).toBe(2)
    expect(im!.area).toBe(78)
    expect(im!.dados_conflitantes).toBe(true)
  })

  it('extrai as fotos em alta resolução', () => {
    expect(im!.fotos.length).toBeGreaterThanOrEqual(10)
    expect(im!.fotos[0]).toContain('img.auxiliadorapredial.com.br')
    expect(im!.fotos[0]).toContain('/thumb/1920/')
  })

  it('extrai o corretor', () => {
    expect(im!.corretor_nome).toBe('Lilian Matoso')
    expect(im!.corretor_telefone).toBe('555132166184')
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
    expect(new Set(ids).size).toBe(ids.length) // sem duplicatas
  })
})
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npm test -- tests/parser.test.ts`
Expected: FAIL — `Cannot find module '@/lib/parser'`.

- [ ] **Step 3: Implementar o parser**

Criar `lib/parser.ts`:

```typescript
import type { Imovel } from './tipos'

type Node = Record<string, any>

function extrairJsonLd(html: string): Node[] {
  const blocos = [...html.matchAll(
    /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g
  )]
  const nodes: Node[] = []
  for (const [, raw] of blocos) {
    try {
      const d = JSON.parse(raw.trim())
      if (Array.isArray(d['@graph'])) nodes.push(...d['@graph'])
      else nodes.push(d)
    } catch { /* bloco malformado: ignora */ }
  }
  return nodes
}

function precoPorNome(specs: Node[] | undefined, nome: string): number | null {
  const s = (specs ?? []).find(x => x.name === nome)
  return s?.price != null ? Number(s.price) : null
}

function propriedade(props: Node[] | undefined, nome: string): number | null {
  const p = (props ?? []).find(x => x.name === nome)
  return p?.value != null ? Number(p.value) : null
}

export function parsearImovel(html: string, url: string): Imovel | null {
  const nodes = extrairJsonLd(html)
  const listing = nodes.find(n => n['@type'] === 'RealEstateListing')
  const webpage = nodes.find(n => n['@type'] === 'WebPage')
  if (!listing) return null

  const offer = listing.offers ?? {}
  const item  = offer.itemOffered ?? {}
  const addr  = item.address ?? {}

  const titulo = webpage?.name ?? listing.name ?? ''

  // Valores do JSON-LD
  const dormLd = item.numberOfRooms != null ? Number(item.numberOfRooms) : null
  const areaLd = item.floorSize?.value != null ? Number(item.floorSize.value) : null

  // Valores extraídos do título (fonte concorrente)
  const mDorm = titulo.match(/(\d+)\s*(?:quartos?|dormit[óo]rios?)/i)
  const mArea = titulo.match(/([\d.,]+)\s*m²/i)
  const dormTit = mDorm ? Number(mDorm[1]) : null
  const areaTit = mArea ? Number(mArea[1].replace(/\./g, '').replace(',', '.')) : null

  // O título é a fonte de verdade quando diverge do JSON-LD.
  const dormitorios = dormTit ?? dormLd
  const area        = areaTit ?? areaLd
  const conflito =
    (dormTit != null && dormLd != null && dormTit !== dormLd) ||
    (areaTit != null && areaLd != null && Math.abs(areaTit - areaLd) > 1)

  // "Apartamento - Centro Histórico - Porto Alegre"
  const partes = String(listing.name ?? '').split(' - ').map(s => s.trim())
  const bairro = partes.length >= 3 ? partes[1] : (addr.addressLocality ?? 'Porto Alegre')

  const fotos = (listing.image ?? [])
    .map((i: Node | string) => (typeof i === 'string' ? i : i.url))
    .filter(Boolean)

  return {
    codigo_origem: String(listing.identifier),
    url_origem: url,
    titulo,
    descricao: webpage?.description ?? null,
    preco: precoPorNome(offer.priceSpecification, 'Valor do imóvel') ?? Number(offer.price),
    condominio: precoPorNome(offer.priceSpecification, 'Condomínio'),
    iptu: precoPorNome(offer.priceSpecification, 'IPTU'),
    area,
    dormitorios,
    suites: propriedade(listing.additionalProperty, 'Suítes'),
    banheiros: item.numberOfBathroomsTotal != null ? Number(item.numberOfBathroomsTotal) : null,
    vagas: propriedade(listing.additionalProperty, 'Vagas de Garagem'),
    bairro,
    endereco: addr.streetAddress ?? null,
    cidade: addr.addressLocality ?? 'Porto Alegre',
    fotos,
    corretor_nome: listing.provider?.name ?? null,
    corretor_telefone: listing.provider?.telephone ?? null,
    publicado_em: listing.datePosted ?? null,
    dados_conflitantes: conflito,
  }
}

export function extrairIdsDaListagem(html: string): string[] {
  const ids = [...html.matchAll(/\/imovel\/venda\/(\d+)/g)].map(m => m[1])
  return [...new Set(ids)]
}
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npm test -- tests/parser.test.ts`
Expected: PASS, 8 testes.

Se `bairro` falhar, inspecione o valor real com:
`node -e "const{parsearImovel}=require('./lib/parser');console.log(parsearImovel(require('fs').readFileSync('tests/fixtures/imovel-484012.html','utf-8'),'x').bairro)"`
e ajuste a heurística de split — não ajuste o teste para passar.

- [ ] **Step 5: Commit**

```bash
git add lib/parser.ts tests/
git commit -m "feat: parser de anúncio com cruzamento título x JSON-LD"
```

---

## Task 4: Coletor

**Files:**
- Create: `scripts/coletar.ts`

- [ ] **Step 1: Escrever o script**

Criar `scripts/coletar.ts`:

```typescript
import { parsearImovel, extrairIdsDaListagem } from '../lib/parser'
import { inserirImovel } from '../lib/db'

const BASE = 'https://www.auxiliadorapredial.com.br'
const UA = 'imoveis-ia-rs/1.0 (POC academica; contato: growth@o2inc.com.br)'
const BAIRROS = [
  'moinhos-de-vento', 'cidade-baixa', 'bom-fim', 'santana',
  'petropolis', 'menino-deus', 'centro-historico',
]
const META = 100

const dormir = (ms: number) => new Promise(r => setTimeout(r, ms))

async function pegar(url: string): Promise<string | null> {
  const r = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!r.ok) { console.warn(`  ${r.status} em ${url}`); return null }
  return r.text()
}

async function main() {
  // 1. Descobrir IDs, bairro a bairro, até bater a meta
  const ids = new Set<string>()
  for (const b of BAIRROS) {
    if (ids.size >= META) break
    const html = await pegar(`${BASE}/comprar/residencial/rs+porto-alegre+${b}`)
    if (html) {
      const antes = ids.size
      extrairIdsDaListagem(html).forEach(i => ids.add(i))
      console.log(`${b}: +${ids.size - antes} (total ${ids.size})`)
    }
    await dormir(1000)
  }

  // 2. Buscar e gravar cada anúncio
  const alvo = [...ids].slice(0, META)
  let ok = 0, falhas = 0, conflitos = 0
  for (const [i, id] of alvo.entries()) {
    const url = `${BASE}/imovel/venda/${id}/apartamento+porto-alegre+rio-grande-do-sul`
    const html = await pegar(url)
    if (html) {
      const im = parsearImovel(html, url)
      if (im) {
        await inserirImovel(im)
        ok++
        if (im.dados_conflitantes) conflitos++
      } else {
        falhas++
        console.warn(`  parse falhou: ${id}`)
      }
    } else {
      falhas++
    }
    if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${alvo.length}`)
    await dormir(1000)
  }

  console.log(`\nGravados: ${ok} | Falhas: ${falhas} | Com dados conflitantes: ${conflitos}`)
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
```

Rate limit de 1 req/s e User-Agent identificável. Um parse que falha aborta aquele registro em vez de gravar lixo no banco.

- [ ] **Step 2: Rodar a coleta**

Run: `docker compose up -d && npx dotenv -e .env.local -- npm run coletar`

Se `dotenv-cli` não estiver instalado, use: `DATABASE_URL=postgresql://imoveis:imoveis@localhost:5433/imoveis npm run coletar`

Expected: leva ~3 minutos (100 requisições a 1/s mais as listagens). Ao final, "Gravados: 100" ou próximo disso.

- [ ] **Step 3: Verificar o banco**

Run:
```bash
docker compose exec db psql -U imoveis -d imoveis -c \
  "SELECT count(*) total, count(*) FILTER (WHERE dados_conflitantes) conflitos,
          round(avg(preco)) preco_medio, count(DISTINCT bairro) bairros FROM imoveis;"
```
Expected: `total` próximo de 100, `bairros` ≥ 5, `preco_medio` numa faixa plausível para POA (entre 300 mil e 1,5 milhão).

Se `total` for muito menor que 100, o portal pode ter mudado a estrutura — investigue com o parser contra uma página recém-baixada antes de seguir.

- [ ] **Step 4: Commit**

```bash
git add scripts/coletar.ts
git commit -m "feat: coletor de anuncios da Auxiliadora Predial"
```

---

## Task 5: Motor de ranking (TDD)

**Files:**
- Create: `lib/score.ts`, `tests/score.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/score.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { scoreImovel } from '@/lib/score'
import type { Imovel } from '@/lib/tipos'

const base: Imovel = {
  codigo_origem: '1', url_origem: 'x', titulo: 'Apto', descricao: null,
  preco: 500000, condominio: 800, iptu: 1200, area: 80,
  dormitorios: 2, suites: 1, banheiros: 2, vagas: 1,
  bairro: 'Menino Deus', endereco: null, cidade: 'Porto Alegre',
  fotos: [], corretor_nome: null, corretor_telefone: null,
  publicado_em: null, dados_conflitantes: false, custo_mensal: 900,
}

describe('scoreImovel', () => {
  it('dá 100 quando nenhum critério foi informado', () => {
    expect(scoreImovel(base, {}).score).toBe(100)
  })

  it('dá 100 quando o imóvel atende a tudo', () => {
    const r = scoreImovel(base, { preco_max: 600000, dorm_min: 2, bairros: ['Menino Deus'] })
    expect(r.score).toBe(100)
    expect(r.nao_atende).toHaveLength(0)
    expect(r.atende.length).toBe(3)
  })

  it('penaliza sem zerar quando estoura pouco o orçamento', () => {
    const r = scoreImovel(base, { preco_max: 480000 })
    expect(r.score).toBeGreaterThan(0)
    expect(r.score).toBeLessThan(100)
    expect(r.nao_atende[0]).toMatch(/orçamento/i)
  })

  it('zera o critério quando estoura muito o orçamento', () => {
    expect(scoreImovel(base, { preco_max: 200000 }).score).toBe(0)
  })

  it('normaliza: um critério atendido entre dois vale 50', () => {
    const r = scoreImovel(base, { dorm_min: 2, vagas_min: 3 })
    expect(r.score).toBe(50)
  })

  it('ignora critério cujo campo é nulo no imóvel', () => {
    const semVagas = { ...base, vagas: null }
    expect(scoreImovel(semVagas, { vagas_min: 2, dorm_min: 2 }).score).toBe(100)
  })

  it('compara bairro sem diferenciar acento ou caixa', () => {
    const r = scoreImovel({ ...base, bairro: 'Centro Histórico' }, { bairros: ['centro historico'] })
    expect(r.score).toBe(100)
  })

  it('devolve score inteiro entre 0 e 100', () => {
    const r = scoreImovel(base, { preco_max: 490000, dorm_min: 3, area_min: 100 })
    expect(Number.isInteger(r.score)).toBe(true)
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(100)
  })
})
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npm test -- tests/score.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

Criar `lib/score.ts`:

```typescript
import type { Imovel, Criterios, ImovelComScore } from './tipos'

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

/** 1.0 se dentro do teto; decai linearmente até 0 a 20% acima dele. */
function decaiTeto(valor: number, teto: number): number {
  if (valor <= teto) return 1
  const excesso = (valor - teto) / teto
  return Math.max(0, 1 - excesso / 0.2)
}

/** 1.0 se atinge o mínimo; decai linearmente até 0 a 50% abaixo dele. */
function decaiMinimo(valor: number, minimo: number): number {
  if (valor >= minimo) return 1
  const falta = (minimo - valor) / minimo
  return Math.max(0, 1 - falta / 0.5)
}

const PESOS = {
  orcamento: 30, dormitorios: 20, bairro: 20, area: 15, custo_mensal: 15,
} as const

export function scoreImovel(im: Imovel, c: Criterios): ImovelComScore {
  const atende: string[] = []
  const nao_atende: string[] = []
  let somaPesos = 0
  let somaPontos = 0

  const avaliar = (peso: number, fracao: number, ok: string, ruim: string) => {
    somaPesos += peso
    somaPontos += peso * fracao
    ;(fracao >= 1 ? atende : nao_atende).push(fracao >= 1 ? ok : ruim)
  }

  if (c.preco_max != null) {
    const f = decaiTeto(im.preco, c.preco_max)
    avaliar(PESOS.orcamento, f,
      `dentro do orçamento (${brl(im.preco)})`,
      `acima do orçamento (${brl(im.preco)} vs ${brl(c.preco_max)})`)
  }

  if (c.preco_min != null) {
    const f = im.preco >= c.preco_min ? 1 : 0
    avaliar(PESOS.orcamento / 2, f, 'acima do preço mínimo', 'abaixo do preço mínimo')
  }

  if (c.dorm_min != null && im.dormitorios != null) {
    const f = decaiMinimo(im.dormitorios, c.dorm_min)
    avaliar(PESOS.dormitorios, f,
      `${im.dormitorios} dormitórios`,
      `só ${im.dormitorios} dormitórios (queria ${c.dorm_min})`)
  }

  if (c.vagas_min != null && im.vagas != null) {
    const f = decaiMinimo(im.vagas, c.vagas_min)
    avaliar(PESOS.dormitorios / 2, f,
      `${im.vagas} vaga(s)`,
      `só ${im.vagas} vaga(s) (queria ${c.vagas_min})`)
  }

  if (c.bairros?.length) {
    const alvos = c.bairros.map(norm)
    const f = alvos.includes(norm(im.bairro)) ? 1 : 0
    avaliar(PESOS.bairro, f, `no ${im.bairro}`, `fica no ${im.bairro}, fora dos bairros pedidos`)
  }

  if (c.area_min != null && im.area != null) {
    const f = decaiMinimo(im.area, c.area_min)
    avaliar(PESOS.area, f,
      `${im.area} m²`,
      `${im.area} m² (queria pelo menos ${c.area_min})`)
  }

  if (c.custo_mensal_max != null && im.custo_mensal != null) {
    const f = decaiTeto(Number(im.custo_mensal), c.custo_mensal_max)
    avaliar(PESOS.custo_mensal, f,
      `custo mensal de ${brl(Number(im.custo_mensal))}`,
      `custo mensal de ${brl(Number(im.custo_mensal))}, acima do teto`)
  }

  const score = somaPesos === 0 ? 100 : Math.round((somaPontos / somaPesos) * 100)
  return { ...im, score, atende, nao_atende }
}

export function ranquear(imoveis: Imovel[], c: Criterios): ImovelComScore[] {
  return imoveis.map(i => scoreImovel(i, c)).sort((a, b) => b.score - a.score)
}
```

Um critério que o usuário não informou não entra em `somaPesos` — não pontua e não penaliza. Um critério informado cujo campo é nulo no imóvel também é ignorado, porque penalizar por dado ausente na fonte seria punir o imóvel por uma falha do portal.

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npm test -- tests/score.test.ts`
Expected: PASS, 8 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/score.ts tests/score.test.ts
git commit -m "feat: motor de ranking deterministico com justificativa"
```

---

## Task 6: Tools

**Files:**
- Create: `lib/tools.ts`, `tests/tools.test.ts`

- [ ] **Step 1: Escrever o teste**

Criar `tests/tools.test.ts` (roda contra o banco já populado):

```typescript
import { describe, it, expect } from 'vitest'
import { executarTool, TOOLS } from '@/lib/tools'

describe('TOOLS', () => {
  it('declara as três tools com strict', () => {
    expect(TOOLS.map(t => t.name).sort())
      .toEqual(['buscar_imoveis', 'comparar_imoveis', 'detalhar_imovel'])
    expect(TOOLS.every(t => t.strict === true)).toBe(true)
    expect(TOOLS.every(t => t.input_schema.additionalProperties === false)).toBe(true)
  })
})

describe('executarTool', () => {
  it('busca respeitando o teto de preço e ordena por score', async () => {
    const r = await executarTool('buscar_imoveis', { preco_max: 600000, dorm_min: 2 })
    expect(r.imoveis.length).toBeGreaterThan(0)
    for (const im of r.imoveis) expect(Number(im.preco)).toBeLessThanOrEqual(600000 * 1.2)
    for (let i = 1; i < r.imoveis.length; i++)
      expect(r.imoveis[i - 1].score).toBeGreaterThanOrEqual(r.imoveis[i].score)
  })

  it('cada resultado traz score e justificativa', async () => {
    const { imoveis } = await executarTool('buscar_imoveis', { preco_max: 700000 })
    expect(imoveis[0]).toHaveProperty('score')
    expect(Array.isArray(imoveis[0].atende)).toBe(true)
  })

  it('detalha um imóvel existente', async () => {
    const { imoveis } = await executarTool('buscar_imoveis', {})
    const r = await executarTool('detalhar_imovel', { id: imoveis[0].id })
    expect(r.imovel.id).toBe(imoveis[0].id)
  })

  it('devolve erro legível para id inexistente', async () => {
    const r = await executarTool('detalhar_imovel', { id: 999999 })
    expect(r.erro).toBeTruthy()
  })
})
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npm test -- tests/tools.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

Criar `lib/tools.ts`:

```typescript
import { buscar, porId, porIds } from './db'
import { ranquear, scoreImovel } from './score'
import type { Criterios } from './tipos'

export const TOOLS = [
  {
    name: 'buscar_imoveis',
    description:
      'Busca apartamentos à venda em Porto Alegre no banco e devolve até 20 ' +
      'ranqueados por aderência aos critérios, cada um com um score de 0 a 100 ' +
      'e a lista do que atende e do que não atende. Chame assim que tiver ao ' +
      'menos um critério concreto. Informe apenas os critérios que a pessoa ' +
      'realmente mencionou — critério não informado não penaliza nenhum imóvel.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        preco_max:        { type: ['number', 'null'], description: 'Teto de preço em reais' },
        preco_min:        { type: ['number', 'null'], description: 'Piso de preço em reais' },
        bairros:          { type: ['array', 'null'], items: { type: 'string' },
                            description: 'Bairros de Porto Alegre desejados' },
        dorm_min:         { type: ['integer', 'null'], description: 'Mínimo de dormitórios' },
        vagas_min:        { type: ['integer', 'null'], description: 'Mínimo de vagas de garagem' },
        area_min:         { type: ['number', 'null'], description: 'Área mínima em m²' },
        custo_mensal_max: { type: ['number', 'null'],
                            description: 'Teto de condomínio + IPTU mensal em reais' },
      },
      required: ['preco_max','preco_min','bairros','dorm_min','vagas_min','area_min','custo_mensal_max'],
      additionalProperties: false,
    },
  },
  {
    name: 'detalhar_imovel',
    description: 'Devolve a ficha completa de um imóvel pelo id, incluindo descrição e fotos.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { id: { type: 'integer' } },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'comparar_imoveis',
    description: 'Compara de 2 a 4 imóveis lado a lado pelos ids.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { ids: { type: 'array', items: { type: 'integer' } } },
      required: ['ids'],
      additionalProperties: false,
    },
  },
] as const

/** Remove as chaves nulas que o strict mode obriga o modelo a mandar. */
function limpar(input: Record<string, unknown>): Criterios {
  return Object.fromEntries(
    Object.entries(input).filter(([, v]) => v != null && !(Array.isArray(v) && v.length === 0))
  ) as Criterios
}

export async function executarTool(nome: string, input: any): Promise<any> {
  switch (nome) {
    case 'buscar_imoveis': {
      const c = limpar(input)
      const encontrados = await buscar(c, 40)
      const imoveis = ranquear(encontrados, c).slice(0, 20)
      return { total: imoveis.length, criterios_aplicados: c, imoveis }
    }
    case 'detalhar_imovel': {
      const im = await porId(Number(input.id))
      return im ? { imovel: im } : { erro: `Nenhum imóvel com id ${input.id}.` }
    }
    case 'comparar_imoveis': {
      const ids = (input.ids ?? []).map(Number)
      if (ids.length < 2) return { erro: 'Informe ao menos 2 ids para comparar.' }
      const imoveis = await porIds(ids)
      return { imoveis: imoveis.map(i => scoreImovel(i, {})) }
    }
    default:
      return { erro: `Tool desconhecida: ${nome}` }
  }
}
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npm test -- tests/tools.test.ts`
Expected: PASS, 5 testes. Requer o banco populado pela Task 4.

- [ ] **Step 5: Commit**

```bash
git add lib/tools.ts tests/tools.test.ts
git commit -m "feat: tools de busca, detalhe e comparacao"
```

---

## Task 7: Cliente Claude e rota SSE

**Files:**
- Create: `lib/claude.ts`, `app/api/chat/route.ts`

- [ ] **Step 1: Escrever o cliente**

Criar `lib/claude.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { TOOLS, executarTool } from './tools'

const client = new Anthropic()

const SYSTEM = `Você é um corretor de imóveis experiente de Porto Alegre. Seu banco tem
100 apartamentos à venda na cidade, e é a sua única fonte de informação.

Como você trabalha:
- Abra a conversa com uma pergunta aberta sobre o que a pessoa procura. Deixe ela falar.
- Extraia os critérios do que ela disser. Pergunte só o que faltar e for decisivo — no
  máximo uma pergunta por vez, nunca um questionário.
- Assim que tiver ao menos um critério concreto, chame buscar_imoveis. Não espere ter tudo.
- Ao apresentar, fale como corretor, não como planilha: diga por que aquele imóvel serve
  para aquela pessoa, e diga também o que nele não serve. Um bom corretor aponta o defeito
  antes que o cliente descubra sozinho.
- Cite no máximo 3 imóveis por vez, do maior score para o menor.

Regras que você não quebra:
- Todo imóvel e todo número que você citar vem do resultado de uma tool. Você nunca inventa
  preço, área, bairro, número de quartos ou imóvel.
- O score e as listas "atende" e "nao_atende" já vêm calculados. Você narra o que elas
  dizem — não recalcula, não estima, não arredonda por conta própria.
- Se um imóvel vier com dados_conflitantes, avise que a informação do anúncio original
  é inconsistente e vale confirmar com o corretor.
- Se a busca não retornar nada, diga isso e sugira qual critério afrouxar.

Escreva em português do Brasil, direto e sem enrolação.`

export type EventoChat =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'imoveis'; imoveis: unknown[] }
  | { tipo: 'fim' }

export async function* conversar(
  mensagens: Anthropic.MessageParam[]
): AsyncGenerator<EventoChat> {
  const historico = [...mensagens]

  for (let i = 0; i < 8; i++) {
    const stream = client.messages.stream({
      model: 'claude-opus-5',
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system: SYSTEM,
      tools: TOOLS as unknown as Anthropic.Tool[],
      messages: historico,
    })

    for await (const evento of stream) {
      if (evento.type === 'content_block_delta' && evento.delta.type === 'text_delta') {
        yield { tipo: 'texto', texto: evento.delta.text }
      }
    }

    const resposta = await stream.finalMessage()
    historico.push({ role: 'assistant', content: resposta.content })

    if (resposta.stop_reason !== 'tool_use') break

    const chamadas = resposta.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    )
    const resultados: Anthropic.ToolResultBlockParam[] = []

    for (const c of chamadas) {
      const saida = await executarTool(c.name, c.input)
      if (Array.isArray(saida?.imoveis)) {
        yield { tipo: 'imoveis', imoveis: saida.imoveis }
      }
      resultados.push({
        type: 'tool_result',
        tool_use_id: c.id,
        content: JSON.stringify(saida),
      })
    }

    // Todos os tool_result numa única mensagem user — separá-los ensina o
    // modelo a parar de fazer chamadas paralelas.
    historico.push({ role: 'user', content: resultados })
  }

  yield { tipo: 'fim' }
}
```

Usa `claude-opus-5` com `thinking: adaptive` (o parâmetro `budget_tokens` foi removido nesse modelo e retorna 400) e streaming, para o texto chegar token a token.

- [ ] **Step 2: Escrever a rota SSE**

Criar `app/api/chat/route.ts`:

```typescript
import { conversar } from '@/lib/claude'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: Request) {
  const { mensagens } = await req.json()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const evento of conversar(mensagens)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(evento)}\n\n`))
        }
      } catch (erro) {
        console.error('Erro no chat:', erro)
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ tipo: 'erro', mensagem: 'Falha ao consultar os imóveis.' })}\n\n`
        ))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
```

- [ ] **Step 3: Testar manualmente**

Preencha `ANTHROPIC_API_KEY` em `.env.local`, então:

```bash
npm run dev
```

Em outro terminal:

```bash
curl -N -X POST http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"mensagens":[{"role":"user","content":"quero um apê de 2 quartos até 600 mil, de preferência no Menino Deus"}]}'
```

Expected: uma sequência de eventos `data: {"tipo":"texto",...}`, ao menos um `{"tipo":"imoveis",...}` com imóveis reais do banco, e um `{"tipo":"fim"}` ao final. Confira que os preços citados no texto batem com os do payload de imóveis — se divergirem, o system prompt não está segurando o modelo e precisa endurecer.

- [ ] **Step 4: Commit**

```bash
git add lib/claude.ts app/api/chat
git commit -m "feat: motor de conversa com tool use e streaming SSE"
```

---

## Task 8: Design system

**Files:**
- Create: `styles/system.css`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Escrever os tokens e componentes**

Criar `styles/system.css` com os valores exatos extraídos do iaraautomacoes.com.br:

```css
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');

:root {
  --bg: #080808;   --bg-2: #0a0a0a;  --bg-3: #0f0f0f;
  --line: rgba(255,255,255,.07);
  --green: #00e87a; --green-2: #00a854;
  --green-dim: rgba(0,232,122,.15);
  --green-glow: rgba(0,232,122,.35);
  --ink: #f4f6f4;  --muted: #9aa39c; --muted-2: #6b736c;
  --sans: 'Outfit', system-ui, sans-serif;
  --mono: 'Space Mono', ui-monospace, monospace;
  --max: 1180px;
  --ease: cubic-bezier(.22,1,.36,1);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: var(--bg); color: var(--ink);
  font-family: var(--sans); font-size: 16px; line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

a { color: inherit; text-decoration: none; }

h1, h2, h3 { font-weight: 800; letter-spacing: -.045em; line-height: 1; }
h1 { font-size: clamp(44px, 8.6vw, 90px); line-height: .98; max-width: 14ch; }
h2 { font-size: clamp(34px, 5vw, 58px); }
h3 { font-size: 21px; font-weight: 700; letter-spacing: -.03em; }

.wrap { max-width: var(--max); margin: 0 auto; padding: 0 24px; width: 100%; }
.section-pad { padding: 120px 0; }
.section-alt { background: var(--bg-3); }
.section-head { max-width: 720px; margin-bottom: 64px; }
.section-head p { color: var(--muted); font-size: clamp(16px, 2vw, 19px); max-width: 560px; }

.eyebrow {
  font-family: var(--mono); font-size: 12px; letter-spacing: .22em;
  text-transform: uppercase; color: var(--green);
  display: inline-flex; align-items: center; gap: 10px;
}
.eyebrow::before {
  content: ''; width: 26px; height: 1px;
  background: linear-gradient(90deg, transparent, var(--green));
}

.btn {
  display: inline-flex; align-items: center; gap: 10px;
  font-weight: 600; font-size: 15px; padding: 15px 26px;
  border-radius: 999px; border: 0; cursor: pointer;
  letter-spacing: -.01em; white-space: nowrap;
  transition: .35s var(--ease);
}
.btn-solid {
  background: linear-gradient(120deg, var(--green), var(--green-2));
  color: #04140c;
  box-shadow: 0 8px 30px -8px var(--green-glow), inset 0 1px 0 rgba(255,255,255,.25);
}
.btn-solid:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 44px -8px var(--green-glow), inset 0 1px 0 rgba(255,255,255,.3);
}
.btn-outline {
  border: 1px solid rgba(255,255,255,.16);
  background: rgba(255,255,255,.02); color: var(--ink);
}
.btn-outline:hover { border-color: var(--green-dim); background: rgba(0,232,122,.06); }

.card {
  border-radius: 20px; border: 1px solid var(--green-dim);
  background: rgba(0,232,122,.024); backdrop-filter: blur(12px);
  padding: 28px 24px; transition: .3s var(--ease);
}
.card:hover { border-color: var(--green); transform: translateY(-3px); }

.pill {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 16px; border-radius: 999px;
  border: 1px solid var(--green-dim); background: rgba(255,255,255,.02);
  font-family: var(--mono); font-size: 11px; letter-spacing: .1em;
  text-transform: uppercase; color: var(--muted);
}
.pill .dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--green); box-shadow: 0 0 10px var(--green);
}

.nav { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 22px 0; }
.nav-links { display: flex; align-items: center; gap: 30px; }
.nav-links a { font-size: 14.5px; color: var(--muted); font-weight: 500; position: relative; transition: .25s; }
.nav-links a:hover { color: var(--ink); }
.nav-links a::after {
  content: ''; position: absolute; left: 0; bottom: -6px;
  width: 0; height: 1px; background: var(--green); transition: .3s var(--ease);
}
.nav-links a:hover::after { width: 100%; }

.hero { padding: 170px 0 90px; text-align: center; position: relative; overflow: hidden; }
.hero h1 { margin: 0 auto 28px; }
.hero p.sub { font-size: clamp(17px, 2.3vw, 21px); color: var(--muted); max-width: 600px; margin: 0 auto 40px; }
.hero-cta { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
.hero-spot {
  position: absolute; inset: 0; z-index: 1; pointer-events: none;
  mix-blend-mode: screen; opacity: 0; transition: opacity .5s var(--ease);
  background: radial-gradient(280px 280px at var(--mx,50%) var(--my,40%),
    rgba(0,232,122,.22), rgba(0,232,122,.07) 42%, transparent 70%);
}
.hero:hover .hero-spot { opacity: 1; }
.hero .wrap { position: relative; z-index: 2; }

.grid-imoveis {
  display: grid; gap: 24px;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
}

@media (max-width: 760px) {
  .section-pad { padding: 72px 0; }
  .hero { padding: 120px 0 64px; }
  .nav-links { display: none; }
}
```

- [ ] **Step 2: Importar no layout**

Substituir `app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import '@/styles/system.css'
import ChatPanel from '@/components/ChatPanel'

export const metadata: Metadata = {
  title: 'Encontre seu apê em Porto Alegre — conversando',
  description: 'Diga o que você procura. A IA encontra o imóvel certo no nosso banco.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <ChatPanel />
      </body>
    </html>
  )
}
```

Remova qualquer `globals.css` do `create-next-app` para não conflitar.

- [ ] **Step 3: Commit**

```bash
git add styles app/layout.tsx
git rm -f app/globals.css 2>/dev/null || true
git commit -m "feat: design system clonado do iaraautomacoes"
```

---

## Task 9: Card e páginas

**Files:**
- Create: `components/CardImovel.tsx`, `components/Nav.tsx`, `app/imoveis/page.tsx`, `app/imovel/[id]/page.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Card de imóvel**

Criar `components/CardImovel.tsx`:

```tsx
import type { ImovelComScore } from '@/lib/tipos'

const brl = (n: number | null) =>
  n == null ? '—' : Number(n).toLocaleString('pt-BR',
    { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export default function CardImovel({ im }: { im: Partial<ImovelComScore> & { id?: number } }) {
  return (
    <a href={`/imovel/${im.id}`} className="card" style={{ display: 'block' }}>
      {im.fotos?.[0] && (
        <img src={im.fotos[0]} alt="" loading="lazy"
             style={{ width: '100%', height: 190, objectFit: 'cover',
                      borderRadius: 12, marginBottom: 16 }} />
      )}

      {im.score != null && (
        <div className="pill" style={{ marginBottom: 12 }}>
          <span className="dot" />{im.score}% de match
        </div>
      )}

      <h3 style={{ marginBottom: 8 }}>{brl(im.preco ?? null)}</h3>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 14 }}>
        {im.bairro} · {im.dormitorios ?? '?'} dorm · {im.area ?? '?'} m²
        {im.vagas ? ` · ${im.vagas} vaga${im.vagas > 1 ? 's' : ''}` : ''}
      </p>

      {im.atende?.slice(0, 2).map(t => (
        <p key={t} style={{ fontSize: 13, color: 'var(--green)', marginBottom: 4 }}>✓ {t}</p>
      ))}
      {im.nao_atende?.slice(0, 1).map(t => (
        <p key={t} style={{ fontSize: 13, color: 'var(--muted-2)' }}>· {t}</p>
      ))}

      {im.dados_conflitantes && (
        <p style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 10 }}>
          ⚠ dados inconsistentes no anúncio original
        </p>
      )}
    </a>
  )
}
```

- [ ] **Step 2: Nav e home**

Criar `components/Nav.tsx` com a marca à esquerda e links (`Imóveis`, `Como funciona`) à direita, usando as classes `.nav` e `.nav-links`.

Substituir `app/page.tsx` por uma home Server Component com:
- `.hero` com `.eyebrow` ("100 imóveis em Porto Alegre"), H1 forte ("Descreva o apê. A IA acha."), `p.sub`, e dois botões (`.btn-solid` abrindo o chat, `.btn-outline` para `/imoveis`), mais a `div.hero-spot`
- Seção "Como funciona" em 3 cards (conversa → IA busca → ranking justificado)
- Seção de destaques: `await todos(6)` e renderizar em `.grid-imoveis`
- CTA final

Adicionar um `useEffect` num pequeno Client Component para atualizar `--mx` / `--my` no `.hero` conforme o mouse, replicando o spotlight da Iara.

- [ ] **Step 3: Vitrine e detalhe**

`app/imoveis/page.tsx` — Server Component: `await todos(100)`, filtros simples por query string (`?bairro=&preco_max=`), grid de cards.

`app/imovel/[id]/page.tsx` — `await porId(Number(params.id))`, galeria de fotos, ficha (preço, condomínio, IPTU, custo mensal, área, dormitórios, suítes, banheiros, vagas, endereço), descrição, dados do corretor, aviso de `dados_conflitantes` quando aplicável, e um botão que abre o chat pré-preenchido com "Me fala sobre o imóvel #{id}". `notFound()` se não existir.

- [ ] **Step 4: Verificar**

Run: `npm run dev` e abrir `http://localhost:3000`
Expected: fundo `#080808`, H1 grande e bem apertado, verde neon apenas nos acentos, cards com borda esverdeada e blur, spotlight seguindo o mouse no hero. Compare lado a lado com `https://iaraautomacoes.com.br` — a sensação visual deve ser a mesma.

- [ ] **Step 5: Commit**

```bash
git add components app/page.tsx app/imoveis app/imovel
git commit -m "feat: home, vitrine e pagina de detalhe"
```

---

## Task 10: Painel de chat

**Files:**
- Create: `components/ChatPanel.tsx`

- [ ] **Step 1: Implementar o painel**

Criar `components/ChatPanel.tsx` como Client Component (`'use client'`) com:

**Estado:** `aberto`, `mensagens` (histórico exibido), `imoveis` (últimos resultados), `carregando`, `parcial` (texto em streaming).

**Layout:** `position: fixed`, lado direito, largura 720px quando aberto (conversa 380px à esquerda, resultados no restante), altura total, fundo `var(--bg-2)`, borda esquerda `var(--line)`. Quando fechado, um FAB redondo no canto inferior direito com `.btn-solid` e um dot pulsando. Abaixo de 900px, ocupa a tela toda.

**Envio:**

```tsx
async function enviar(texto: string) {
  const novas = [...mensagens, { role: 'user' as const, content: texto }]
  setMensagens(novas); setCarregando(true); setParcial('')

  const r = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mensagens: novas }),
  })

  const reader = r.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let acumulado = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const linhas = buffer.split('\n\n')
    buffer = linhas.pop() ?? ''

    for (const linha of linhas) {
      if (!linha.startsWith('data: ')) continue
      const ev = JSON.parse(linha.slice(6))
      if (ev.tipo === 'texto')   { acumulado += ev.texto; setParcial(acumulado) }
      if (ev.tipo === 'imoveis') { setImoveis(ev.imoveis) }
      if (ev.tipo === 'erro')    { acumulado += `\n\n${ev.mensagem}`; setParcial(acumulado) }
    }
  }

  setMensagens(m => [...m, { role: 'assistant', content: acumulado }])
  setParcial(''); setCarregando(false)
}
```

**Primeira abertura:** dispara automaticamente uma saudação da IA chamando `enviar('oi')` — ou, mais barato, renderiza uma mensagem fixa de boas-vindas com 3 sugestões clicáveis ("2 quartos até 600 mil", "perto do Parcão", "com vaga e aceita pet"). Prefira a segunda opção: economiza uma chamada de API e dá ao usuário exemplos concretos do que dá para pedir.

**Resultados:** coluna direita renderiza `imoveis.map(im => <CardImovel im={im} />)` num grid de uma coluna, com scroll próprio. Vazio no início, com um texto discreto: "Os imóveis aparecem aqui conforme a gente conversa."

**Detalhe de acabamento:** o painel deve deslizar com `transform: translateX()` e `transition: .35s var(--ease)` — a mesma curva do resto do sistema. Auto-scroll da conversa para o fim a cada token recebido.

- [ ] **Step 2: Testar o fluxo completo**

Run: `npm run dev`, abrir o site, clicar no FAB e digitar:
`"quero um apê de 2 quartos até 600 mil, de preferência no Menino Deus ou Cidade Baixa"`

Expected:
1. Texto aparece token a token à esquerda
2. Cards aparecem à direita durante a resposta, ordenados por score decrescente
3. A IA justifica cada indicação citando o que atende e o que não atende
4. Os preços citados no texto batem exatamente com os dos cards
5. Uma pergunta de acompanhamento ("e com vaga?") refina a busca sem perder o contexto

- [ ] **Step 3: Commit**

```bash
git add components/ChatPanel.tsx
git commit -m "feat: painel de chat lateral com resultados em tempo real"
```

---

## Task 11: Verificação final

- [ ] **Step 1: Suíte completa**

Run: `npm test`
Expected: todos os testes passam (parser, score, tools).

- [ ] **Step 2: Build de produção**

Run: `npm run build`
Expected: build conclui sem erro de tipo.

- [ ] **Step 3: Checagem de integridade dos dados**

Run:
```bash
docker compose exec db psql -U imoveis -d imoveis -c \
  "SELECT count(*) total,
          count(*) FILTER (WHERE dados_conflitantes) conflitos,
          count(*) FILTER (WHERE fotos IS NULL OR array_length(fotos,1) IS NULL) sem_foto,
          count(*) FILTER (WHERE dormitorios IS NULL) sem_dorm
   FROM imoveis;"
```
Expected: `total` próximo de 100; `sem_foto` e `sem_dorm` baixos. Se `sem_dorm` for alto, o regex de dormitórios do parser não está cobrindo as variações de título — corrija o parser e recolete.

- [ ] **Step 4: Escrever o README**

Criar `README.md` com: o que é, como subir (`docker compose up -d`, aplicar schema, `npm run coletar`, `npm run dev`), variáveis de ambiente necessárias, e uma nota honesta de que a ingestão é scraping de POC e precisa virar feed oficial antes de qualquer uso público.

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "docs: README com instrucoes de setup"
```

---

## Notas de execução

- **Nunca** rode `DELETE`, `DROP`, `TRUNCATE` ou `UPDATE` no banco. A repopulação usa `ON CONFLICT DO NOTHING`. Se precisar recomeçar do zero, pergunte antes.
- Rate limit de 1 req/s no coletor não é negociável — é o que mantém a coleta educada e o que evita bloqueio.
- Se o parser falhar em um anúncio, ele deve abortar aquele registro e seguir. Nunca gravar registro parcial.
- Se o modelo citar um preço que não bate com o payload da tool, o problema é do system prompt, não do usuário. Endureça a regra e teste de novo.
