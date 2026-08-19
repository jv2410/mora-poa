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

-- Atributos extraídos das descrições em texto livre por um LLM, cada um com a
-- CITAÇÃO LITERAL que o comprova. A evidência é validada por substring antes
-- de gravar: se a citação não aparece no texto original, o atributo é
-- descartado. Isso torna "o modelo não inventa" verificável mecanicamente.
CREATE TABLE IF NOT EXISTS atributos_extraidos (
  imovel_id    INT NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE,
  atributo     TEXT NOT NULL,
  valor        BOOLEAN NOT NULL,
  evidencia    TEXT NOT NULL,
  extraido_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (imovel_id, atributo)
);

CREATE INDEX IF NOT EXISTS idx_atributos_atributo ON atributos_extraidos (atributo, valor);
CREATE INDEX IF NOT EXISTS idx_atributos_imovel   ON atributos_extraidos (imovel_id);

-- Histórico de preço: uma linha por anúncio por dia de coleta. O valor deste
-- dado é função do tempo — quanto antes começar a gravar, antes rende.
CREATE TABLE IF NOT EXISTS historico_precos (
  codigo_origem TEXT NOT NULL,
  preco         NUMERIC(12,2) NOT NULL,
  visto_em      DATE NOT NULL DEFAULT current_date,
  UNIQUE (codigo_origem, visto_em)
);

-- Eficiência da planta: quanto da área que você paga é realmente sua.
-- Um fator de 0,55 significa que 45% do m² pago é corredor e área comum.
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS eficiencia NUMERIC(4,3)
  GENERATED ALWAYS AS (
    CASE WHEN area_total > 0 AND area > 0 AND area <= area_total
    THEN area / area_total END
  ) STORED;

-- Custo de 10 anos: preço + condomínio e IPTU pagos ao longo de 120 meses.
-- NULL quando o condomínio não foi informado — de propósito. Com COALESCE 0
-- o anúncio que esconde o condomínio venceria o ranking, ou seja, a falta de
-- informação viraria vantagem competitiva. Preferimos não ranquear.
ALTER TABLE imoveis ADD COLUMN IF NOT EXISTS custo_10_anos NUMERIC(14,2)
  GENERATED ALWAYS AS (
    CASE WHEN condominio IS NOT NULL
    THEN preco + (condominio + COALESCE(iptu, 0) / 12) * 120 END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_imoveis_custo_10a ON imoveis (custo_10_anos);
CREATE INDEX IF NOT EXISTS idx_imoveis_eficiencia ON imoveis (eficiencia);

-- Atributos extraídos das FOTOS. A evidência aqui não é uma citação de texto,
-- é o índice da foto onde o modelo diz ter visto aquilo — apontável e
-- verificável: se apontar para a foto 40 de um anúncio com 12, é descartado,
-- e na interface o chip abre exatamente a foto citada.
CREATE TABLE IF NOT EXISTS atributos_visuais (
  imovel_id   INT NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE,
  atributo    TEXT NOT NULL,
  valor       BOOLEAN NOT NULL,
  foto_index  SMALLINT NOT NULL,
  foto_url    TEXT NOT NULL,
  modelo      TEXT NOT NULL,
  extraido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (imovel_id, atributo)
);
CREATE INDEX IF NOT EXISTS idx_visuais_atributo ON atributos_visuais (atributo, valor);
CREATE INDEX IF NOT EXISTS idx_visuais_imovel ON atributos_visuais (imovel_id);
