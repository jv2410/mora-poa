-- Migration aditiva: login e multiusuário (itens 6, 7 e 13 do documento v2).
-- Só CREATE TABLE, ADD COLUMN e CREATE INDEX.

-- ---------------------------------------------------------------------------
-- Conta = a imobiliária contratante. O MVP é só para imobiliárias, mas o
-- corretor autônomo entra no mesmo desenho: uma conta com um usuário só.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contas (
  id         serial PRIMARY KEY,
  nome       text NOT NULL,
  -- Percentual de comissão do cliente. Configurável porque varia entre
  -- imobiliárias e entre imóvel próprio e de parceria — o documento é
  -- explícito sobre isso no glossário.
  comissao_pct numeric(5,2) NOT NULL DEFAULT 5.00,
  -- Mensalidade paga, base do múltiplo de retorno.
  mensalidade  numeric(10,2),
  -- Minutos que o corretor leva para analisar 30 imóveis à mão. É informado no
  -- cadastro e entra na fórmula de horas economizadas, que precisa ser visível.
  min_por_30_imoveis int NOT NULL DEFAULT 8,
  criada_em  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Usuários e papéis.
--
-- Quatro papéis, como no documento: corretor usa, gerente cobra resultado,
-- diretor assina, e `iara` é o god mode de quem opera o produto. O papel
-- decide qual painel a pessoa vê — três perfis, três visões, e não uma tela
-- tentando servir os três.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id         serial PRIMARY KEY,
  conta_id   int NOT NULL REFERENCES contas(id),
  nome       text NOT NULL,
  email      text UNIQUE NOT NULL,
  -- scrypt: derivação com custo, do próprio Node. Guardamos sal e parâmetros
  -- junto do hash para poder endurecer o custo depois sem invalidar senha
  -- nenhuma.
  senha_hash text NOT NULL,
  papel      text NOT NULL DEFAULT 'corretor'
             CHECK (papel IN ('corretor','gerente','diretor','iara')),
  criado_em  timestamptz NOT NULL DEFAULT now(),
  ultimo_acesso timestamptz
);

CREATE INDEX IF NOT EXISTS usuarios_conta_idx ON usuarios (conta_id);

-- ---------------------------------------------------------------------------
-- Sessões. Token opaco no cookie httpOnly; o banco é a fonte da verdade, para
-- um logout invalidar de verdade em vez de só apagar o cookie do navegador.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessoes (
  token      text PRIMARY KEY,
  usuario_id int NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criada_em  timestamptz NOT NULL DEFAULT now(),
  expira_em  timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS sessoes_usuario_idx ON sessoes (usuario_id);
CREATE INDEX IF NOT EXISTS sessoes_expira_idx  ON sessoes (expira_em);

-- ---------------------------------------------------------------------------
-- Costura do que já foi gravado sem login.
--
-- As buscas e seleções existentes têm `corretor_id`, um id anônimo de
-- navegador. Ao entrar pela primeira vez, esse id é reivindicado pelo usuário
-- e o histórico que a pessoa já produziu passa a aparecer no painel dela.
-- Nada é apagado nem reescrito: só anotamos a quem pertence.
-- ---------------------------------------------------------------------------
ALTER TABLE buscas   ADD COLUMN IF NOT EXISTS usuario_id int REFERENCES usuarios(id);
ALTER TABLE selecoes ADD COLUMN IF NOT EXISTS usuario_id int REFERENCES usuarios(id);
ALTER TABLE imoveis  ADD COLUMN IF NOT EXISTS conta_id   int REFERENCES contas(id);

CREATE INDEX IF NOT EXISTS buscas_usuario_idx   ON buscas (usuario_id, criada_em DESC);
CREATE INDEX IF NOT EXISTS selecoes_usuario_idx ON selecoes (usuario_id, criada_em DESC);

-- Vincula um id anônimo de navegador a um usuário.
CREATE TABLE IF NOT EXISTS corretor_ids (
  corretor_id text PRIMARY KEY,
  usuario_id  int NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  vinculado_em timestamptz NOT NULL DEFAULT now()
);
