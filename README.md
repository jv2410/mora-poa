# mora.ai

Plataforma de busca de imóveis em Porto Alegre onde a pessoa **conversa** em vez de
preencher filtro. A IA extrai os critérios da conversa, consulta um banco de 100
apartamentos reais e devolve os melhores ranqueados — com a explicação do que bate
e do que não bate em cada um.

## O que faz

- **Banco real:** 100 apartamentos à venda em Porto Alegre, coletados das páginas
  públicas da Auxiliadora Predial. Moinhos de Vento, Santana, Bom Fim, Cidade Baixa
  e Petrópolis.
- **Chat que não inventa:** todo imóvel citado existe e todo número vem do banco.
  O ranking é calculado em TypeScript; o modelo apenas narra o resultado.
- **Ranking explicável:** cada imóvel tem score de 0 a 100 e duas listas — o que
  atende e o que não atende aos critérios da pessoa.

## Rodando

Pré-requisitos: Node 20+, Postgres 12+ rodando localmente.

```bash
# 1. Dependências
npm install

# 2. Banco
createdb imoveis
psql -d imoveis -f db/schema.sql

# 3. Variáveis de ambiente
cp .env.local.example .env.local   # e preencha ANTHROPIC_API_KEY

# 4. Popular o banco (~3 min, faz 107 requisições a 1 req/s)
npm run coletar

# 5. Subir
npm run dev
```

### Variáveis

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | Conexão com o Postgres |
| `ANTHROPIC_API_KEY` | Chat com `claude-opus-5` |

## Testes

```bash
npm test
```

30 testes. Os do parser rodam contra HTML real capturado do portal
(`tests/fixtures/`), incluindo um anúncio cuja informação estruturada diverge do
título. Os das tools rodam contra o banco populado.

## Arquitetura

| Arquivo | Responsabilidade |
|---|---|
| `scripts/coletar.ts` | Descobre IDs por bairro, busca cada anúncio, grava |
| `lib/parser.ts` | HTML → `Imovel`, cruzando JSON-LD com o título |
| `lib/db.ts` | Pool e queries, todas parametrizadas |
| `lib/score.ts` | Ranking — função pura, sem LLM |
| `lib/tools.ts` | As 3 tools que a IA pode chamar |
| `lib/claude.ts` | Loop de tool use com streaming |
| `app/api/chat/route.ts` | SSE |
| `styles/system.css` | Design system |

### Por que o ranking não fica com o LLM

A tool devolve o score já calculado junto das listas `atende` / `nao_atende`, e o
modelo é instruído a narrar essas listas — não a recalcular. É o que separa uma
ferramenta confiável de um chat que inventa imóvel com confiança. Numa decisão de
onde morar, um número inventado custa caro.

## Duas coisas que a fonte ensinou

**Área privativa e área total são coisas diferentes.** O JSON-LD do portal traz a
área total; o título do anúncio traz a privativa e conta as suítes entre os
quartos. Na primeira versão isso foi tratado como erro e a flag de inconsistência
disparou em 95 dos 100 imóveis. Um alerta que aparece em 95% dos casos não alerta
nada — só ensina o usuário a ignorá-lo. Hoje guardamos as duas medidas e a flag
marca só anomalia real (1 imóvel).

**O portal grava o mesmo bairro em caixas diferentes.** "BOM FIM" e "Bom Fim"
viravam dois bairros na vitrine. O parser normaliza em Title Case, preservando as
minúsculas de ligação ("Moinhos de Vento").

## Limite conhecido

A ingestão é scraping das páginas públicas do portal, com rate limit de 1 req/s,
User-Agent identificável e `robots.txt` respeitado (que permite `/` inclusive para
`ClaudeBot`, e proíbe `/api/` — por isso a coleta usa só HTML público). As imagens
são referenciadas do CDN de origem, não reempacotadas.

Isso serve para POC. **Antes de qualquer uso público, a camada de ingestão precisa
virar feed oficial ou parceria com a imobiliária.** O schema é agnóstico à origem
justamente para que essa troca não toque no resto do sistema.
