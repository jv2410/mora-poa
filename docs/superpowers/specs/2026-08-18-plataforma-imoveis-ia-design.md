# Plataforma de Busca de Imóveis com IA Conversacional — Design

**Data:** 2026-08-18
**Status:** Aprovado pelo usuário (aguardando revisão do spec)

## Problema

Buscar imóvel em portal é um exercício de preencher filtros. A pessoa sabe o que quer em linguagem natural ("dois quartos perto do metrô, até 600 mil, aceito prédio antigo se tiver vaga") e precisa traduzir isso em checkboxes. A plataforma inverte isso: a pessoa conversa, a IA extrai os critérios, consulta o banco e devolve os imóveis ranqueados com a justificativa de cada match.

## Escopo

**Dentro:** coletor de 100 apartamentos à venda em Porto Alegre (Auxiliadora Predial), banco Postgres local, motor de ranking, chat com IA em painel lateral fixo, landing + vitrine + página de detalhe no design system do iaraautomacoes.com.br.

**Fora:** autenticação, favoritos, agendamento de visita, painel de corretor, deploy em produção.

---

## 1. Ingestão

`scripts/coletar.ts` — roda uma vez, popula o banco.

### Viabilidade (verificada em 2026-08-18)

- `curl` simples com User-Agent de navegador → HTTP 200, HTML de ~198KB renderizado no servidor. Sem Cloudflare, sem DataDome, sem captcha.
- `robots.txt` permite `/` para todos os agentes, incluindo `ClaudeBot` explicitamente. Bloqueia `/api/`, `/_next/`, `/admin/`, `/private/`, `/selecionados/` e `*.json`.
- **Consequência de projeto:** a coleta usa exclusivamente as páginas HTML públicas. A API interna do Next.js não é tocada, porque `robots.txt` a proíbe.

### Padrões de URL

| Recurso | Padrão |
|---|---|
| Listagem por bairro | `/comprar/residencial/rs+porto-alegre+{bairro}` |
| Detalhe do imóvel | `/imovel/venda/{id}/apartamento+porto-alegre+rio-grande-do-sul` |

Paginação por query string não funciona (`?pagina=2` devolve a página 1). Coleta-se por bairro: cada listagem entrega 22 imóveis únicos. Verificado com 4 bairros → 88 IDs distintos, zero sobreposição. 6 bairros cobrem os 100 com folga.

Bairros: `moinhos-de-vento`, `cidade-baixa`, `bom-fim`, `santana`, `petropolis`, `menino-deus`, `centro-historico`.

### Passos

1. **Descobrir IDs** — para cada bairro, `GET` a listagem, extrair via regex `/imovel/venda/(\d+)`, deduplicar até 100.
2. **Buscar cada anúncio** — `GET` da página de detalhe, 1 req/s, `User-Agent` identificável com e-mail de contato.
3. **Parsear** — extrair o `<script type="application/ld+json">` cujo `@graph` contém `@type: "RealEstateListing"`.

### Campos disponíveis no JSON-LD

Verificado no imóvel 484012:

| Campo na fonte | Nosso campo |
|---|---|
| `identifier` | `codigo_origem` |
| `url` | `url_origem` |
| `mainEntity.name` (WebPage) | `titulo` |
| `mainEntity.description` | `descricao` |
| `offers.priceSpecification[]` — "Valor do imóvel" / "Condomínio" / "IPTU" | `preco`, `condominio`, `iptu` |
| `offers.itemOffered.floorSize.value` | `area` |
| `offers.itemOffered.numberOfRooms` | `dormitorios` |
| `offers.itemOffered.numberOfBathroomsTotal` | `banheiros` |
| `additionalProperty[]` — "Suítes" / "Vagas de Garagem" | `suites`, `vagas` |
| `offers.itemOffered.address.streetAddress` | `endereco` |
| `breadcrumb` / título | `bairro` |
| `image[]` (10 fotos, 1920px) | `fotos` |
| `provider.name` / `.telephone` | `corretor_nome`, `corretor_telefone` |
| `datePosted` | `publicado_em` |

### Problema conhecido: dados conflitantes na fonte

No imóvel 484012 o JSON-LD informa `numberOfRooms: 1` e `floorSize: 120.96`, enquanto o título do próprio anúncio diz *"Apartamento com 2 quartos e 78m²"*. Os dois números divergem.

**Mitigação:** o parser extrai também do título via regex (`(\d+)\s*quartos?`, `([\d,.]+)\s*m²`). Quando os valores divergem, prevalece o título e o registro recebe `dados_conflitantes = true`. Sem isso, o motor de ranking compara imóveis usando número de quartos errado — e a plataforma passa a mentir com confiança, que é o pior modo de falha possível para este produto.

### Imagens

Referenciadas pela URL do CDN da origem (`img.auxiliadorapredial.com.br`). Não são baixadas nem reempacotadas.

### Limite conhecido

Esta camada depende de scraping e dos Termos de Uso da Auxiliadora. Para uso além de POC local, a ingestão precisa ser trocada por feed oficial ou parceria. O schema abaixo é agnóstico à origem justamente para permitir essa troca sem tocar no resto do sistema.

---

## 2. Banco

Postgres 16 via Docker Compose. Tabela única `imoveis`, colunas tipadas — o motor de busca precisa filtrar em SQL, não em JSON blob.

```sql
CREATE TABLE imoveis (
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

CREATE INDEX idx_imoveis_preco       ON imoveis (preco);
CREATE INDEX idx_imoveis_bairro      ON imoveis (bairro);
CREATE INDEX idx_imoveis_dormitorios ON imoveis (dormitorios);
```

`preco_m2` e `custo_mensal` são colunas geradas porque são exatamente o que a IA vai querer comparar, e cálculo aritmético não é responsabilidade que se delega a um LLM.

Migrations aditivas apenas. Popular com `INSERT ... ON CONFLICT (codigo_origem) DO NOTHING`.

---

## 3. Motor de IA

### Modelo

`claude-opus-5` via `@anthropic-ai/sdk`, com `thinking: { type: "adaptive" }`, `output_config: { effort: "medium" }` e streaming (`client.messages.stream`) para o chat responder token a token.

### Tools

Três, declaradas com `strict: true`:

| Tool | Entrada | Saída |
|---|---|---|
| `buscar_imoveis` | `preco_max`, `preco_min`, `bairros[]`, `dorm_min`, `vagas_min`, `area_min`, `custo_mensal_max`, `ordenar_por` | Até 20 imóveis com score |
| `detalhar_imovel` | `id` | Ficha completa de um imóvel |
| `comparar_imoveis` | `ids[]` (2 a 4) | Tabela comparativa lado a lado |

Todas as tools consultam o Postgres por SQL parametrizado. Nenhum valor exibido ao usuário é gerado pelo modelo.

### Ranking

`lib/score.ts` — função pura em TypeScript, sem LLM:

```
scoreImovel(imovel, criterios) -> { score: 0..100, atende: string[], nao_atende: string[] }
```

Pesos: orçamento 30, dormitórios 20, bairro 20, área 15, custo mensal 15. Critério não informado pelo usuário não pontua e não penaliza — o peso é redistribuído proporcionalmente entre os critérios informados.

A tool devolve o score já calculado junto de `atende`/`nao_atende`. O LLM **narra** essa justificativa; não a inventa. Essa separação é o que distingue a plataforma de um chat que alucina imóvel: todo número na tela veio do banco, e todo imóvel citado existe.

### Conversa

O system prompt instrui: abrir com pergunta aberta, extrair critérios do que a pessoa disser, perguntar apenas o que falta e for decisivo, nunca inventar imóvel ou número, e sempre justificar o ranking em linguagem de corretor — não de planilha.

Estado da conversa em memória no servidor por `sessionId`. Sem persistência (fora do escopo do MVP).

### Rota

`POST /api/chat` — Server-Sent Events. Loop manual de tool use: enquanto `stop_reason === "tool_use"`, executar as tools, devolver todos os `tool_result` em uma única mensagem `user`, repetir. Limite de 8 iterações.

O evento SSE carrega dois tipos: `text` (delta de texto) e `imoveis` (payload dos resultados, para o front renderizar os cards à direita em tempo real).

---

## 4. Front

### Design system

Extraído do iaraautomacoes.com.br em 2026-08-18. O site expõe o sistema inteiro em CSS custom properties:

```css
:root {
  --bg: #080808;      --bg-2: #0a0a0a;   --bg-3: #0f0f0f;
  --line: rgba(255,255,255,.07);
  --green: #00e87a;   --green-2: #00a854;
  --green-dim: rgba(0,232,122,.15);
  --green-glow: rgba(0,232,122,.35);
  --ink: #f4f6f4;     --muted: #9aa39c;  --muted-2: #6b736c;
  --sans: 'Outfit', system-ui, sans-serif;
  --mono: 'Space Mono', ui-monospace, monospace;
  --max: 1180px;
  --ease: cubic-bezier(.22,1,.36,1);
}
```

Assinaturas a replicar:

| Elemento | Especificação |
|---|---|
| H1 | `clamp(44px,8.6vw,90px)`, peso 800, `letter-spacing: -.045em`, `line-height: .98`, `max-width: 14ch` |
| H2 de seção | `clamp(34px,5vw,58px)`, mesmo tracking |
| Eyebrow | Space Mono, 12px, uppercase, `letter-spacing: .22em`, cor `--green`, com tracinho gradiente de 26px antes via `::before` |
| Botão sólido | `padding: 15px 26px`, `border-radius: 999px`, `linear-gradient(120deg, var(--green), var(--green-2))`, texto `#04140c`, `box-shadow: 0 8px 30px -8px var(--green-glow), inset 0 1px 0 rgba(255,255,255,.25)`, hover `translateY(-2px)` |
| Botão outline | `border: 1px solid rgba(255,255,255,.16)`, `background: rgba(255,255,255,.02)`, hover borda `--green-dim` |
| Card | `border-radius: 20px`, `border: 1px solid var(--green-dim)`, `backdrop-filter: blur(12px)`, `padding: 38px 34px` |
| Pill / badge | `border-radius: 999px`, borda `--green-dim`, dot de 8px com `box-shadow: 0 0 10px var(--green)` |
| Container | `max-width: 1180px`, `padding: 0 24px` |
| Seção | `padding: 120px 0`, alternando fundo `#080808` / `#0f0f0f` |
| Nav link | 14.5px, cor `--muted`, sublinhado que cresce de 0 a 100% no hover |
| Hero | `padding: 170px 0 90px`, centralizado, com spotlight radial verde seguindo o mouse (`mix-blend-mode: screen`) |

CSS puro seguindo essa nomenclatura semântica (`.btn`, `.btn-solid`, `.wrap`, `.eyebrow`, `.section-pad`). Sem Tailwind — o sistema de origem é CSS semântico e clonar direto é mais fiel.

Fontes Outfit e Space Mono via Google Fonts.

### Páginas

| Rota | Conteúdo |
|---|---|
| `/` | Hero + como funciona + grid de destaques + CTA final |
| `/imoveis` | Grid com filtros tradicionais (para quem prefere clicar) |
| `/imovel/[id]` | Galeria, ficha completa, botão "perguntar à IA sobre este" |

### Chat

Painel lateral fixo, presente em todas as páginas. Conversa à esquerda, cards de resultado à direita, atualizando em tempo real conforme a IA busca. Colapsável. Em telas menores que 900px vira drawer full-screen.

Essa é a decisão de produto central: o chat não é uma página que se visita, é a interface. Ver os cards aparecerem enquanto se conversa é o que torna a tese óbvia em cinco segundos.

---

## 5. Stack

- Next.js 15 (App Router) + TypeScript
- Postgres 16 via Docker Compose, acesso com `pg` e SQL parametrizado (sem ORM — as queries são poucas e específicas)
- `@anthropic-ai/sdk`
- CSS puro, sem framework de UI
- Vitest

Estrutura:

```
scripts/coletar.ts        # ingestão
lib/parser.ts             # JSON-LD + título -> Imovel
lib/db.ts                 # pool e queries
lib/score.ts              # ranking (função pura)
lib/tools.ts              # definição e execução das 3 tools
lib/claude.ts             # cliente e loop de tool use
app/api/chat/route.ts     # SSE
app/(site)/...            # páginas
components/chat/...       # painel
styles/system.css         # tokens do design system
```

## 6. Testes

Onde o erro é caro e silencioso:

- **`lib/parser.ts`** — HTML real salvo como fixture, incluindo o caso 484012 com dados conflitantes. Testa extração de cada campo, o cruzamento título × JSON-LD, e a marcação de `dados_conflitantes`.
- **`lib/score.ts`** — função pura. Casos: nenhum critério informado, critério único, todos os critérios, imóvel que estoura o orçamento, campo nulo no imóvel.
- **`lib/tools.ts`** — execução das tools contra um banco de teste com fixtures conhecidos.

Não há teste de componente visual.

## 7. Riscos

| Risco | Mitigação |
|---|---|
| Auxiliadora muda o HTML e o parser quebra | Parser isolado em um módulo com fixtures; falha de parse aborta o registro em vez de gravar lixo |
| Dados conflitantes na fonte | Cruzamento título × JSON-LD, flag `dados_conflitantes` |
| Termos de Uso / scraping | POC local, rate limit de 1 req/s, `robots.txt` respeitado, URL de origem preservada, imagens por referência. Camada de ingestão isolada para troca futura |
| LLM inventar imóvel ou número | Todo dado vem de tool que consulta SQL; score calculado em TypeScript; system prompt proíbe explicitamente |
| Loop infinito de tool use | Limite de 8 iterações por turno |
