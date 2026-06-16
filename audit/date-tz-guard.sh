#!/usr/bin/env bash
# audit/date-tz-guard.sh — bloqueia regressão de shift UTC em datepickers.
#
# Falha (exit 1) se algum arquivo em src/ usar os anti-padrões abaixo
# SEM constar na allowlist `audit/date-tz-allowlist.txt`:
#
#   1. .toISOString().split("T")[0]          → grava DATE com shift UTC
#   2. new Date("YYYY-MM-DD")                → lê DATE com shift UTC
#
# Use `parseLocalDate` / `formatLocalDate` de `@/lib/utils/parseLocalDate`.
set -euo pipefail

ALLOWLIST="audit/date-tz-allowlist.txt"
[ -f "$ALLOWLIST" ] || { echo "FAIL allowlist ausente: $ALLOWLIST"; exit 1; }

# Lê allowlist ignorando comentários e linhas vazias.
allowed="$(grep -vE '^\s*(#|$)' "$ALLOWLIST" | sort -u)"

# Acha ofensores atuais (exclui o próprio parseLocalDate.ts e arquivos de teste).
offenders="$(
  {
    rg --files-with-matches "toISOString\(\)\.split\(['\"]T['\"]\)\[0\]" src/ 2>/dev/null || true;
    rg --files-with-matches "new Date\(['\"][0-9]{4}-[0-9]{2}-[0-9]{2}['\"]\)" src/ 2>/dev/null || true;
  } | sort -u \
    | grep -vE '(^|/)parseLocalDate\.ts$' \
    | grep -vE '/__tests__/' \
    | grep -vE '\.(test|spec)\.(ts|tsx)$' || true
)"

# Diferença: ofensor NÃO listado na allowlist.
new_offenders="$(comm -23 <(printf '%s\n' "$offenders") <(printf '%s\n' "$allowed") || true)"

# Stale: arquivo na allowlist que já não ofende (foi refatorado).
stale="$(comm -13 <(printf '%s\n' "$offenders") <(printf '%s\n' "$allowed") || true)"

fail=0
if [ -n "$new_offenders" ]; then
  echo "FAIL anti-padrão de timezone introduzido em arquivo(s) novo(s):"
  echo "$new_offenders" | sed 's/^/  - /'
  echo
  echo "  → Substitua por parseLocalDate / formatLocalDate de @/lib/utils/parseLocalDate."
  echo "  → Documentação: src/lib/utils/parseLocalDate.ts (cabeçalho)."
  fail=1
fi

if [ -n "$stale" ]; then
  echo "WARN arquivo(s) na allowlist sem mais o anti-padrão (remover do allowlist):"
  echo "$stale" | sed 's/^/  - /'
  # stale é warning informativo, não falha — pra não bloquear refatorações.
fi

if [ "$fail" -eq 0 ]; then
  echo "OK   date-tz-guard: nenhuma regressão de fuso horário em datepickers."
  exit 0
fi
exit 1
