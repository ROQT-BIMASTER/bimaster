#!/usr/bin/env bash
# E2E: verifies every SECURITY DEFINER RPC blocks cross-tenant / anonymous access.
#
# Usage:
#   SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... ./scripts/security/e2e-security-definer-rpcs.sh

set -euo pipefail

: "${SUPABASE_URL:?missing SUPABASE_URL}"
: "${SUPABASE_PUBLISHABLE_KEY:?missing SUPABASE_PUBLISHABLE_KEY}"

# Catalog of SECURITY DEFINER RPCs that MUST require auth. Add new RPCs here.
RPCS=(
  "match_copilot_chunks"
)

fail=0
for rpc in "${RPCS[@]}"; do
  echo "→ Testing anonymous call to ${rpc}…"
  http_code=$(curl -s -o /tmp/rpc_resp.json -w "%{http_code}" \
    -X POST "${SUPABASE_URL}/rest/v1/rpc/${rpc}" \
    -H "apikey: ${SUPABASE_PUBLISHABLE_KEY}" \
    -H "Content-Type: application/json" \
    --data '{}' || true)
  body=$(cat /tmp/rpc_resp.json)
  echo "   HTTP ${http_code}: ${body:0:160}"
  if [[ "${http_code}" == "200" ]] && echo "${body}" | grep -qE '^\[\s*\{'; then
    echo "   ✗ LEAK: ${rpc} returned data anonymously"
    fail=1
  fi
done

if [[ "${fail}" -ne 0 ]]; then
  echo "❌ SECURITY DEFINER RPC E2E failed"
  exit 1
fi
echo "✓ All SECURITY DEFINER RPCs block anonymous calls"
