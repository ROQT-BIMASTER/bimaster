#!/usr/bin/env bash
# E2E for citation/number contract (C1/C2 of RFC v4.0.0).
# Asserts unverifiable numbers don't leak into the executive_summary.

set -euo pipefail

: "${SUPABASE_URL:?missing SUPABASE_URL}"
: "${SUPABASE_PUBLISHABLE_KEY:?missing SUPABASE_PUBLISHABLE_KEY}"
COPILOT_FN="${COPILOT_FN:-central-copilot}"

resp=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/${COPILOT_FN}" \
  -H "Authorization: Bearer ${SUPABASE_PUBLISHABLE_KEY}" \
  -H "apikey: ${SUPABASE_PUBLISHABLE_KEY}" \
  -H "Content-Type: application/json" \
  --data '{"text":"Quantos pedidos abertos eu tenho?","copilotId":"central","clientActionId":"e2e-test"}')

echo "${resp}" | head -c 800
echo

unverifiable=$(echo "${resp}" | jq -r '.meta.unverifiableCount // 0')
echo "unverifiableCount=${unverifiable}"

in_summary=$(echo "${resp}" | jq -r '
  (.assistantMessage // "")
  | capture("(?<es>Resumo executivo[\\s\\S]*?)(\\n##|\\n\\n|$)").es // ""
  | test("\\b[0-9]+([.,][0-9]+)?\\b")
')
echo "exec_summary_has_numbers=${in_summary}"

if [[ "${unverifiable}" -gt 0 ]] && [[ "${in_summary}" == "true" ]]; then
  echo "❌ Contract violation: unverifiable numbers leaked into executive_summary"
  exit 1
fi

echo "✓ Citation/number contract holds for ${COPILOT_FN}"
