#!/usr/bin/env bash
# E2E — Critical Edge Functions must reject unauthenticated / underprivileged callers.
#
# Every function below MUST return 401 (no JWT) and 401/403 (JWT with anon key) —
# never 200 nor 500. Signals that `verify_jwt`/`secureHandler` gate is intact.
#
# Env:
#   SUPABASE_URL         project functions host
#   SUPABASE_ANON_KEY    publishable/anon key (JWT-shaped but no user session)
#
# Exit codes: 0 = all gated, 1 = at least one endpoint returned unexpected status.

set -u

: "${SUPABASE_URL:?defina SUPABASE_URL}"
: "${SUPABASE_ANON_KEY:?defina SUPABASE_ANON_KEY}"

FUNCTIONS=(
  "datawarehouse-api"
  "export-datawarehouse"
  "extrair-materia-prima-ia"
  "extrair-produto-ia"
  "analisar-planilha-ia"
  "projeto-ia-assistant"
  "whatsapp-business-api"
  "process-nfe-xml"
  "send-push-notification"
  "reports-alerts-evaluator"
  "contas-pagar-export-api"
)

FAIL=0

check() {
  local fn="$1"
  local label="$2"
  local extra_headers=("${@:3}")

  local args=(-s -o /dev/null -w '%{http_code}' -X POST "$SUPABASE_URL/functions/v1/$fn" -H 'Content-Type: application/json' -d '{}')
  for h in "${extra_headers[@]}"; do args+=(-H "$h"); done

  local code
  code=$(curl "${args[@]}")
  case "$code" in
    401|403)
      echo "  ✅ $fn [$label] → $code"
      ;;
    *)
      echo "  ❌ $fn [$label] → $code (expected 401 or 403)"
      FAIL=1
      ;;
  esac
}

echo "▶ Critical edge function auth-gate checks"
for fn in "${FUNCTIONS[@]}"; do
  check "$fn" "no-jwt"
  check "$fn" "anon-jwt" "Authorization: Bearer $SUPABASE_ANON_KEY" "apikey: $SUPABASE_ANON_KEY"
done

# Dynamic forms — anonymous INSERT without a valid team_form_tokens row must fail.
echo "▶ dynamic_form_responses anonymous INSERT (no token) must be denied"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  "$SUPABASE_URL/rest/v1/dynamic_form_responses" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H 'Content-Type: application/json' \
  -H 'Prefer: return=minimal' \
  -d '{"form_id":"00000000-0000-0000-0000-000000000000","answers":{}}')
case "$CODE" in
  401|403|404)
    echo "  ✅ dynamic_form_responses insert → $CODE"
    ;;
  *)
    echo "  ❌ dynamic_form_responses insert → $CODE (expected 401/403/404)"
    FAIL=1
    ;;
esac

if [[ "$FAIL" -ne 0 ]]; then
  echo "❌ Security gate FAILED"
  exit 1
fi
echo "✅ All critical endpoints properly gated"
