-- Schema da plataforma de imóveis.
-- APENAS ADITIVO: nada aqui remove, sobrescreve ou apaga dados existentes.

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

  -- Colunas geradas: são exatamente o que a IA compara, e cálculo
  -- aritmético não é responsabilidade que se delega a um LLM.
  preco_m2      NUMERIC(10,2) GENERATED ALWAYS AS
                (CASE WHEN area > 0 THEN preco / area END) STORED,
  custo_mensal  NUMERIC(10,2) GENERATED ALWAYS AS
                (COALESCE(condominio,0) + COALESCE(iptu,0)/12) STORED
);

CREATE INDEX IF NOT EXISTS idx_imoveis_preco       ON imoveis (preco);
CREATE INDEX IF NOT EXISTS idx_imoveis_bairro      ON imoveis (bairro);
CREATE INDEX IF NOT EXISTS idx_imoveis_dormitorios ON imoveis (dormitorios);

-- Área total (inclui comum), do JSON-LD. A coluna `area` guarda a privativa,
-- que é o número do título do anúncio e o que o comprador usa para comparar.
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS area_total NUMERIC(8,2);

-- Multi-fonte: de qual portal veio o anúncio, e os campos que só algumas
-- fontes publicam (a Guarida traz geolocalização e características).
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS fonte TEXT NOT NULL DEFAULT 'auxiliadora';
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7);
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7);
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS caracteristicas TEXT[];
CREATE INDEX IF NOT EXISTS idx_imoveis_fonte ON imoveis (fonte);
