#!/usr/bin/env bash
# scripts/audit/run-all.sh
# Roda todos os geradores. Usado pelo workflow docs-drift.yml e localmente.
set -euo pipefail
cd "$(dirname "$0")/../.."

mkdir -p docs/audit/2026-Q2/generated

node scripts/audit/list-routes.mjs
node scripts/audit/list-edge.mjs
node scripts/audit/list-modules.mjs
node scripts/audit/code-health.mjs

if command -v psql >/dev/null 2>&1 && [ -n "${PGHOST:-}" ]; then
  psql -A -F '|' -t -f scripts/audit/db-stats.sql \
    > docs/audit/2026-Q2/generated/DB_STATS.snapshot.csv
  echo "wrote docs/audit/2026-Q2/generated/DB_STATS.snapshot.csv"
else
  echo "psql/PGHOST indisponível — DB_STATS.snapshot.csv não regenerado"
fi
