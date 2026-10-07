-- Migration aditiva (v2 do documento de produto). Nada aqui apaga, altera ou
-- sobrescreve dado existente: só CREATE TABLE, ADD COLUMN e CREATE INDEX.

-- ---------------------------------------------------------------------------
-- Origem do imóvel: estoque próprio da imobiliária x estoque de parceiro.
--
-- A política de exibição do v2 depende disso. Imóvel próprio tem ficha
-- completa; imóvel de parceiro mostra dados estruturados e o link do anúncio,
-- e esse link só pode aparecer para o corretor — nunca na seleção que vai ao
-- comprador, senão o comprador chega ao corretor concorrente.
--
-- Default 'parceiro' porque todo imóvel que já está no banco veio de fora.
-- ---------------------------------------------------------------------------
ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'parceiro'
  CHECK (origem IN ('proprio', 'parceiro'));

-- ---------------------------------------------------------------------------
-- Saúde do cadastro (L2): 0 a 100 pela presença dos campos que decidem match.
--
-- Coluna gerada em vez de cálculo na aplicação para o número ser o mesmo em
-- qualquer consulta — inclusive nas que o painel de estoque faz direto em SQL.
-- Os pesos refletem o que tira o imóvel do match: sem condomínio ele cai de
-- qualquer briefing com teto de custo mensal, e sem vaga cai de qualquer
-- briefing que exija garagem.
-- ---------------------------------------------------------------------------
ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS qualidade_cadastro int
  GENERATED ALWAYS AS (
      (CASE WHEN area        IS NOT NULL THEN 20 ELSE 0 END)
    + (CASE WHEN condominio  IS NOT NULL THEN 20 ELSE 0 END)
    + (CASE WHEN dormitorios IS NOT NULL THEN 15 ELSE 0 END)
    + (CASE WHEN vagas       IS NOT NULL THEN 15 ELSE 0 END)
    + (CASE WHEN coalesce(array_length(fotos, 1), 0) >= 3 THEN 15 ELSE 0 END)
    + (CASE WHEN descricao   IS NOT NULL THEN 10 ELSE 0 END)
    + (CASE WHEN latitude    IS NOT NULL THEN  5 ELSE 0 END)
  ) STORED;

-- ---------------------------------------------------------------------------
-- Toda busca fica registrada.
--
-- Sem isto não existe Camada 2 ("buscas sem Alta compatibilidade") nem o mapa
-- de demanda não atendida da Camada 5 — e os dois são retrospectivos: medem o
-- passado. Começar a gravar hoje é o que torna o painel possível em 30 dias;
-- não gravar significa que em 30 dias ainda não haverá nada para mostrar.
--
-- corretor_id é um identificador anônimo de navegador enquanto não existe
-- login. Serve para agrupar as buscas de uma mesma pessoa; não identifica
-- ninguém.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS buscas (
  id             serial PRIMARY KEY,
  corretor_id    text,
  briefing       text,
  criterios      jsonb NOT NULL DEFAULT '{}'::jsonb,
  alta           int   NOT NULL DEFAULT 0,
  vale_apresentar int  NOT NULL DEFAULT 0,
  criada_em      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS buscas_criada_idx   ON buscas (criada_em DESC);
CREATE INDEX IF NOT EXISTS buscas_corretor_idx ON buscas (corretor_id);
-- O Demand Gap filtra justamente as buscas que não acharam nada bom.
CREATE INDEX IF NOT EXISTS buscas_sem_alta_idx ON buscas (criada_em DESC) WHERE alta = 0;

-- ---------------------------------------------------------------------------
-- Seleção: o que o corretor aprovou e mandou para o comprador.
--
-- O token é o que vai na URL do WhatsApp. É aleatório e longo porque a página
-- não tem login: quem tem o link vê a seleção.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS selecoes (
  id          serial PRIMARY KEY,
  token       text UNIQUE NOT NULL,
  corretor_id text,
  busca_id    int REFERENCES buscas(id),
  cliente     text,
  criada_em   timestamptz NOT NULL DEFAULT now(),
  enviada_em  timestamptz,
  -- Sinal passivo: "Carlos abriu o apê 6× e não respondeu" nasce daqui.
  aberturas   int NOT NULL DEFAULT 0,
  aberta_em   timestamptz
);

CREATE INDEX IF NOT EXISTS selecoes_corretor_idx ON selecoes (corretor_id, criada_em DESC);

-- ---------------------------------------------------------------------------
-- Item da seleção, com a sequência de status do documento.
--
-- A faixa e a ressalva são congeladas no momento do envio: o preço do imóvel
-- muda, a coleta envelhece, e o que o comprador viu na página precisa
-- continuar sendo o que ele viu.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS selecao_itens (
  id             serial PRIMARY KEY,
  selecao_id     int NOT NULL REFERENCES selecoes(id) ON DELETE CASCADE,
  imovel_id      int NOT NULL REFERENCES imoveis(id),
  faixa          text NOT NULL,
  ressalva       text,
  status         text NOT NULL DEFAULT 'aprovado_corretor'
                 CHECK (status IN ('aprovado_corretor','enviado','visualizado',
                                   'aprovado_comprador','recusado')),
  motivo_recusa  text,
  -- Quantas vezes o comprador abriu este imóvel específico.
  visualizacoes  int NOT NULL DEFAULT 0,
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (selecao_id, imovel_id)
);

CREATE INDEX IF NOT EXISTS selecao_itens_selecao_idx ON selecao_itens (selecao_id);
CREATE INDEX IF NOT EXISTS selecao_itens_imovel_idx  ON selecao_itens (imovel_id);
