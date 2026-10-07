-- Migration aditiva: o desfecho comercial que hoje vem do CRM.
--
-- As tabelas existem no mesmo formato que a sincronização com o CRM vai
-- preencher, então o painel lê daqui tanto no piloto quanto depois de
-- integrado — nenhum código de leitura muda quando o conector entrar.

CREATE TABLE IF NOT EXISTS visitas (
  id            serial PRIMARY KEY,
  usuario_id    int NOT NULL REFERENCES usuarios(id),
  selecao_id    int REFERENCES selecoes(id),
  imovel_id     int NOT NULL REFERENCES imoveis(id),
  cliente       text,
  status        text NOT NULL DEFAULT 'agendada'
                CHECK (status IN ('agendada','realizada','cancelada','remarcada')),
  -- De onde veio o registro. Quando o conector existir, passa a 'crm'.
  origem        text NOT NULL DEFAULT 'mora' CHECK (origem IN ('mora','crm')),
  agendada_para timestamptz,
  criada_em     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visitas_usuario_idx ON visitas (usuario_id, criada_em DESC);

CREATE TABLE IF NOT EXISTS negocios (
  id          serial PRIMARY KEY,
  usuario_id  int NOT NULL REFERENCES usuarios(id),
  imovel_id   int NOT NULL REFERENCES imoveis(id),
  selecao_id  int REFERENCES selecoes(id),
  cliente     text,
  -- Valor fechado. Pode diferir do anunciado: proposta é negociação.
  valor       numeric(14,2) NOT NULL,
  status      text NOT NULL DEFAULT 'proposta'
              CHECK (status IN ('proposta','ganho','perdido')),
  origem      text NOT NULL DEFAULT 'mora' CHECK (origem IN ('mora','crm')),
  criado_em   timestamptz NOT NULL DEFAULT now(),
  fechado_em  timestamptz
);

CREATE INDEX IF NOT EXISTS negocios_usuario_idx ON negocios (usuario_id, criado_em DESC);
