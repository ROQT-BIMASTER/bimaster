#!/usr/bin/env bash
# guard-destructive-migrations.sh
# Bloqueia migrations novas que contenham DELETE/TRUNCATE/DROP em tabelas de
# dados de domínio sem o token explícito de override:
#   -- ALLOW-DESTRUCTIVE: <motivo + ticket>
#
# Motivado pelo incidente 2026-05-16 (perda Fábrica BR).
# Doc: docs/incidents/2026-05-16-fabrica-br-data-loss.md
#
# Uso:
#   bash scripts/ci/guard-destructive-migrations.sh [arquivo1.sql arquivo2.sql ...]
# Sem argumentos: varre todo supabase/migrations/.

set -euo pipefail

# Prefixos de domínio considerados "dados de negócio" (não cadastro estático).
DOMAIN_PREFIXES=(
  "fabrica_"
  "china_"
  "projeto_"
  "projetos_"
  "trade_"
  "financeiro_"
  "contas_"
  "marketing_"
  "inbox_"
  "vendas_"
  "compras_"
  "estoque_"
  "composicao_"
  "ficha_"
  "ordens_"
  "produtos_"
  "tarefas_"
  "aprovacoes_"
  "aprovacao_"
)

# Regex de operações destrutivas (case-insensitive aplicado via grep -i).
# Cobre:
#   DELETE FROM <prefix>...
#   TRUNCATE [TABLE] <prefix>...
#   DROP TABLE [IF EXISTS] <prefix>...
#   DROP SCHEMA
#   ALTER TABLE <prefix>... DROP COLUMN
build_pattern() {
  local prefixes_alt
  prefixes_alt=$(IFS='|'; echo "${DOMAIN_PREFIXES[*]}")
  cat <<EOF
(DELETE[[:space:]]+FROM[[:space:]]+(public\.)?($prefixes_alt))|(TRUNCATE([[:space:]]+TABLE)?[[:space:]]+(public\.)?($prefixes_alt))|(DROP[[:space:]]+TABLE([[:space:]]+IF[[:space:]]+EXISTS)?[[:space:]]+(public\.)?($prefixes_alt))|(DROP[[:space:]]+SCHEMA)|(ALTER[[:space:]]+TABLE[[:space:]]+(public\.)?($prefixes_alt)[[:space:]a-z_0-9.]*DROP[[:space:]]+COLUMN)
EOF
}

PATTERN=$(build_pattern)
TOKEN="ALLOW-DESTRUCTIVE"

if [ "$#" -gt 0 ]; then
  FILES=("$@")
else
  mapfile -t FILES < <(find supabase/migrations -type f -name '*.sql' 2>/dev/null || true)
fi

fail=0
checked=0

for f in "${FILES[@]}"; do
  [ -f "$f" ] || continue
  checked=$((checked+1))

  if grep -E -i -q "$PATTERN" "$f"; then
    if grep -q "$TOKEN" "$f"; then
      echo "OK   $f  (destrutivo com override $TOKEN)"
    else
      echo "FAIL $f  contém operação destrutiva sem token '-- $TOKEN: <motivo + ticket>'"
      echo "     Trechos suspeitos:"
      grep -E -i -n "$PATTERN" "$f" | sed 's/^/       /'
      fail=1
    fi
  fi
done

echo "---"
echo "Arquivos verificados: $checked"

if [ "$fail" -ne 0 ]; then
  cat <<'MSG'

Operação destrutiva detectada em migration sem aprovação explícita.

Para liberar, adicione no topo da migration um comentário no formato:
  -- ALLOW-DESTRUCTIVE: <motivo curto> (ticket BIM-####)

E garanta:
  1. Escopo por tabela (não use prefixo amplo sem necessidade).
  2. Backup/PITR confirmado antes do deploy.
  3. Revisor humano além do autor da migration.

Ref.: docs/incidents/2026-05-16-fabrica-br-data-loss.md
MSG
  exit 1
fi

exit 0
