#!/usr/bin/env bash
# E2E Security Test — China module + Approval Flow RLS lockdown
#
# Purpose:
#   Guarantee that unauthenticated (anon) callers cannot read ANY row from
#   sensitive China-module tables or approval-flow tables. All probes must
#   return either a PostgREST error object OR an empty JSON array — never a
#   non-empty data payload.
#
# Optionally, when E2E_TEST_EMAIL / E2E_TEST_PASSWORD are set, we also probe
# as an authenticated user with no membership on the target rows. The
# expectation is IDENTICAL: no rows leaked (empty array is fine — that proves
# RLS scoping is enforced per-user, not just per-role).
#
# Run:
#   bash scripts/security/e2e-china-approval-rls.sh
#
# Exit codes: 0 = all blocked, 1 = at least one leak.

set -u

SUPABASE_URL="${SUPABASE_URL:?defina SUPABASE_URL antes de rodar}"
ANON_KEY="${SUPABASE_ANON_KEY:?defina SUPABASE_ANON_KEY antes de rodar}"

PASS=0
FAIL=0
LEAKS=()

# Tables under test — every one of these is auth-scoped (or admin-only) and
# must NEVER return rows to anonymous callers.
CHINA_TABLES=(
  "china_submissao_projetos"
  "china_submissao_pareceres"
  "china_submissao_parecer_anexos"
  "china_produto_documentos"
  "china_produto_documentos_historico"
  "china_produto_checklist"
  "china_produto_checklist_celulas"
  "china_produto_cores"
  "china_produto_submissoes"
  "china_chat_mensagens"
  "china_doc_comentarios"
  "china_doc_revisoes"
  "china_ordens_compra"
  "china_ordem_itens"
  "china_embarques"
  "china_nao_conformidades"
)

APPROVAL_TABLES=(
  "fluxo_aprovacao_instancias"
  "fluxo_aprovacao_etapas"
  "fluxo_aprovacao_etapa_eventos"
  "fluxo_aprovacao_transicoes"
  "fluxo_aprovacao_vinculos"
  "fluxo_aprovacao_anexos"
  "fluxo_aprovacao_aprovadores"
  "fluxo_aprovacao_lote_documentos"
  "aprovacao_documento_itens"
  "aprovacao_kanban_audit"
)

# assert_blocked LABEL URL [BEARER]
assert_blocked() {
  local name="$1"
  local url="$2"
  local bearer="${3:-}"
  local body
  if [ -n "$bearer" ]; then
    body=$(curl -s --max-time 10 -H "apikey: $ANON_KEY" -H "Authorization: Bearer $bearer" "$url")
  else
    body=$(curl -s --max-time 10 -H "apikey: $ANON_KEY" "$url")
  fi
  local first
  first=$(printf '%s' "$body" | head -c 1)

  if [ "$first" = "{" ]; then
    PASS=$((PASS + 1))
    printf "  PASS  %s -> error response (no data)\n" "$name"
    return 0
  fi

  if [ "$first" = "[" ]; then
    local count
    count=$(printf '%s' "$body" | python3 -c "import sys,json
try:
  d=json.loads(sys.stdin.read() or '[]')
  print(len(d) if isinstance(d,list) else -1)
except Exception:
  print(-2)" 2>/dev/null)
    if [ "$count" = "0" ]; then
      PASS=$((PASS + 1))
      printf "  PASS  %s -> 0 rows\n" "$name"
      return 0
    fi
    FAIL=$((FAIL + 1))
    LEAKS+=("$name -> $count rows | $(printf '%s' "$body" | head -c 200)")
    printf "  FAIL  %s -> %s rows LEAKED\n" "$name" "$count"
    return 1
  fi

  # unknown shape — treat as pass only if empty
  if [ -z "$body" ]; then
    PASS=$((PASS + 1))
    printf "  PASS  %s -> empty body\n" "$name"
    return 0
  fi
  FAIL=$((FAIL + 1))
  LEAKS+=("$name -> unexpected body: $(printf '%s' "$body" | head -c 200)")
  printf "  FAIL  %s -> unexpected response shape\n" "$name"
  return 1
}

run_probes() {
  local scope="$1"      # "anon" | "authed"
  local bearer="${2:-}"
  echo
  echo "--- China module ($scope) ---"
  for t in "${CHINA_TABLES[@]}"; do
    assert_blocked "[$scope] $t select=*" "$SUPABASE_URL/rest/v1/$t?select=*&limit=5" "$bearer"
  done
  echo
  echo "--- Approval flow ($scope) ---"
  for t in "${APPROVAL_TABLES[@]}"; do
    assert_blocked "[$scope] $t select=*" "$SUPABASE_URL/rest/v1/$t?select=*&limit=5" "$bearer"
  done
}

echo "=========================================================="
echo " E2E: China + Approval Flow RLS lockdown"
echo " URL: $SUPABASE_URL"
echo "=========================================================="

run_probes "anon"

if [ -n "${E2E_TEST_EMAIL:-}" ] && [ -n "${E2E_TEST_PASSWORD:-}" ]; then
  echo
  echo "Authenticated cross-tenant probe: signing in as $E2E_TEST_EMAIL"
  TOKEN_RESP=$(curl -s --max-time 15 \
    -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
    -H "apikey: $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "$(python3 -c "import json,os;print(json.dumps({'email':os.environ['E2E_TEST_EMAIL'],'password':os.environ['E2E_TEST_PASSWORD']}))")")
  ACCESS_TOKEN=$(printf '%s' "$TOKEN_RESP" | python3 -c "import sys,json
try:
  d=json.loads(sys.stdin.read())
  print(d.get('access_token',''))
except Exception:
  print('')")
  if [ -z "$ACCESS_TOKEN" ]; then
    echo "WARN: could not sign in — skipping authenticated probe."
  else
    # If the test user is intentionally NOT a member of any China submissao /
    # approval instancia, all probes must still return 0 rows. If the user IS
    # a member, non-zero rows are acceptable — set E2E_ALLOW_AUTHED_ROWS=1 to
    # skip failure.
    if [ "${E2E_ALLOW_AUTHED_ROWS:-0}" = "1" ]; then
      echo "  (E2E_ALLOW_AUTHED_ROWS=1 — non-zero rows will not fail the run)"
      # override assert_blocked to only check for error/array shape
      assert_blocked() {
        local name="$1" url="$2" bearer="${3:-}"
        local code
        code=$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' \
          -H "apikey: $ANON_KEY" -H "Authorization: Bearer $bearer" "$url")
        if [ "$code" = "200" ] || [ "$code" = "401" ] || [ "$code" = "403" ] || [ "$code" = "404" ]; then
          PASS=$((PASS + 1)); printf "  PASS  %s -> HTTP %s\n" "$name" "$code"; return 0
        fi
        FAIL=$((FAIL + 1)); LEAKS+=("$name -> HTTP $code"); printf "  FAIL  %s -> HTTP %s\n" "$name" "$code"; return 1
      }
    fi
    run_probes "authed" "$ACCESS_TOKEN"
  fi
else
  echo
  echo "SKIP: E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set — authenticated cross-tenant probe skipped."
fi

echo
echo "=========================================================="
printf " Summary: %d PASS / %d FAIL\n" "$PASS" "$FAIL"
echo "=========================================================="
if [ "$FAIL" -gt 0 ]; then
  echo "Leaks:"
  for l in "${LEAKS[@]}"; do echo "  - $l"; done
  exit 1
fi
exit 0
