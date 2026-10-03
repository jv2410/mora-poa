#!/usr/bin/env bash
#
# Leva o banco da MORA para um destino novo.
#
# O dump sai sempre da origem indicada (por padrão o Postgres local, que é a
# cópia canônica) e entra num destino vazio. Nada aqui apaga ou sobrescreve
# dado existente: se o destino já tiver as tabelas, o restore falha e o script
# para, em vez de passar por cima.
#
#   ./scripts/migrar-banco.sh 'postgresql://user:senha@host/db?sslmode=require'
#
set -euo pipefail

DESTINO="${1:-}"
ORIGEM="${ORIGEM:-imoveis}"

if [[ -z "$DESTINO" ]]; then
  echo "uso: $0 <connection-string-do-destino>" >&2
  exit 1
fi

mascarar() { sed -E 's#://[^:]+:[^@]+@#://***:***@#'; }
echo "origem : $ORIGEM"
echo "destino: $(echo "$DESTINO" | mascarar)"

echo
echo "--> o destino está vazio?"
JA_TEM=$(psql "$DESTINO" -tAc \
  "SELECT count(*) FROM information_schema.tables
   WHERE table_schema='public' AND table_name IN
   ('imoveis','atributos_extraidos','atributos_visuais','historico_precos')")

if [[ "$JA_TEM" != "0" ]]; then
  echo "    destino já tem $JA_TEM das 4 tabelas da MORA." >&2
  echo "    abortando para não sobrescrever nada. Limpe o destino à mão se for essa a intenção." >&2
  exit 2
fi
echo "    vazio, seguindo."

echo
echo "--> gerando dump da origem"
DUMP=$(mktemp -t mora-dump)
pg_dump "$ORIGEM" --no-owner --no-privileges -f "$DUMP"
echo "    $(du -h "$DUMP" | cut -f1)"

echo
echo "--> restaurando no destino"
psql "$DESTINO" -v ON_ERROR_STOP=1 -q -f "$DUMP"

echo
echo "--> conferindo"
psql "$DESTINO" -tAc "
  SELECT 'imoveis             ' || count(*) FROM imoveis
  UNION ALL SELECT 'atributos_visuais   ' || count(*) FROM atributos_visuais
  UNION ALL SELECT 'historico_precos    ' || count(*) FROM historico_precos
  UNION ALL SELECT 'atributos_extraidos ' || count(*) FROM atributos_extraidos
  UNION ALL SELECT 'bairros distintos   ' || count(DISTINCT bairro) FROM imoveis" | sed 's/^/    /'

rm -f "$DUMP"
echo
echo "pronto. Falta apontar DATABASE_URL para o destino."
