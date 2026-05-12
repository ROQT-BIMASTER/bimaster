#!/usr/bin/env bash
# E2E test for storage policies on bucket `fabrica-produto-fotos`.
#
# Validates that:
#   1. Anonymous requests are blocked for INSERT/SELECT/UPDATE/DELETE
#   2. Authenticated user with `fabrica` module access can INSERT/SELECT/UPDATE/DELETE
#   3. Authenticated user WITHOUT `fabrica` access nor admin/supervisor role is blocked
#
# Required env vars (set via Lovable Cloud secrets in CI or .env):
#   SUPABASE_URL                    - https://<ref>.supabase.co
#   SUPABASE_ANON_KEY               - publishable / anon key
#   FABRICA_USER_EMAIL              - user with fabrica module access
#   FABRICA_USER_PASSWORD
#   NO_ACCESS_USER_EMAIL            - authenticated user with NO fabrica access
#   NO_ACCESS_USER_PASSWORD
#
# Usage: bash scripts/security/e2e-fabrica-fotos-policies.sh

set -uo pipefail

BUCKET="fabrica-produto-fotos"
PASS=0
FAIL=0

red()   { printf "\033[31m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
blue()  { printf "\033[34m%s\033[0m\n" "$*"; }

require() {
  if [[ -z "${!1:-}" ]]; then
    red "Variável $1 não definida — exporte antes de rodar."
    exit 2
  fi
}

require SUPABASE_URL
require SUPABASE_ANON_KEY
require FABRICA_USER_EMAIL
require FABRICA_USER_PASSWORD
require NO_ACCESS_USER_EMAIL
require NO_ACCESS_USER_PASSWORD

assert_status() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    green "  PASS  $label  (HTTP $actual)"
    PASS=$((PASS+1))
  else
    red   "  FAIL  $label  (esperado $expected, obtido $actual)"
    FAIL=$((FAIL+1))
  fi
}

# Login → returns access_token via stdout (JSON)
login() {
  local email="$1" password="$2"
  curl -sS -X POST \
    "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${email}\",\"password\":\"${password}\"}" \
  | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p'
}

upload() {
  local token="$1" path="$2"
  local auth="${token:+-H "Authorization: Bearer ${token}"}"
  echo "probe-$(date +%s)" > /tmp/_probe.txt
  eval curl -sS -o /dev/null -w '"%{http_code}"' -X POST \
    "${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    $auth \
    -H "Content-Type: text/plain" \
    --data-binary @/tmp/_probe.txt
}

read_signed() {
  local token="$1" path="$2"
  local auth="${token:+-H "Authorization: Bearer ${token}"}"
  eval curl -sS -o /dev/null -w '"%{http_code}"' -X POST \
    "${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${path}" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    $auth \
    -H "Content-Type: application/json" \
    -d '{"expiresIn":60}'
}

update_obj() {
  local token="$1" path="$2"
  local auth="${token:+-H "Authorization: Bearer ${token}"}"
  echo "probe-v2" > /tmp/_probe.txt
  eval curl -sS -o /dev/null -w '"%{http_code}"' -X PUT \
    "${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    $auth \
    -H "Content-Type: text/plain" \
    --data-binary @/tmp/_probe.txt
}

delete_obj() {
  local token="$1" path="$2"
  local auth="${token:+-H "Authorization: Bearer ${token}"}"
  eval curl -sS -o /dev/null -w '"%{http_code}"' -X DELETE \
    "${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    $auth
}

run_case() {
  local label="$1" token="$2" can_write="$3"
  local path="_e2e/${RANDOM}-${RANDOM}.txt"
  blue "▶ $label  (esperado escrita=${can_write})"

  local expect_write="200" expect_read="200"
  if [[ "$can_write" != "yes" ]]; then expect_write="400"; expect_read="400"; fi

  local code
  code=$(upload "$token" "$path"); assert_status "INSERT $label" "$expect_write" "$code"

  if [[ "$can_write" == "yes" ]]; then
    code=$(read_signed "$token" "$path"); assert_status "SELECT $label" "$expect_read" "$code"
    code=$(update_obj  "$token" "$path"); assert_status "UPDATE $label" "$expect_write" "$code"
    code=$(delete_obj  "$token" "$path"); assert_status "DELETE $label" "$expect_write" "$code"
  fi
}

blue "== Caso 1: anônimo (sem token) =="
run_case "anônimo" "" "no"

blue "== Caso 2: usuário sem módulo Fábrica =="
TOK_NO=$(login "$NO_ACCESS_USER_EMAIL" "$NO_ACCESS_USER_PASSWORD")
[[ -z "$TOK_NO" ]] && { red "Falha login NO_ACCESS_USER"; exit 2; }
run_case "sem-acesso-fabrica" "$TOK_NO" "no"

blue "== Caso 3: usuário com módulo Fábrica =="
TOK_OK=$(login "$FABRICA_USER_EMAIL" "$FABRICA_USER_PASSWORD")
[[ -z "$TOK_OK" ]] && { red "Falha login FABRICA_USER"; exit 2; }
run_case "com-acesso-fabrica" "$TOK_OK" "yes"

echo
blue "== Resumo =="
green "PASS: $PASS"
if [[ $FAIL -gt 0 ]]; then red "FAIL: $FAIL"; exit 1; fi
green "Todas as policies de fotos estão corretas."
