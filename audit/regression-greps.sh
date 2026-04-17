#!/usr/bin/env bash
# audit/regression-greps.sh — invariantes pós-PR-7 (SDK v3.0.0 / OpenAPI v4.0.0 / APP v3.0.0)
# Uso: bash audit/regression-greps.sh   → exit 0 se OK, 1 se regredir.
# Rodar antes de qualquer bump de SDK_VERSION / OpenAPI info.version / APP_VERSION.
set -euo pipefail

SDK="src/components/erp/SdkDownloadButtons.tsx"
SPEC="src/components/erp/ApiDocumentation.tsx"
VER="src/lib/version.ts"

fail=0
check() {
  local label="$1" actual="$2" min="$3"
  if [ "$actual" -lt "$min" ]; then
    echo "FAIL $label: $actual < $min"
    fail=1
  else
    echo "OK   $label: $actual >= $min"
  fi
}
checkExact() {
  local label="$1" actual="$2" expected="$3"
  if [ "$actual" -ne "$expected" ]; then
    echo "FAIL $label: $actual != $expected"
    fail=1
  else
    echo "OK   $label: $actual == $expected"
  fi
}

echo "=== Invariantes herdados (PR-1 a PR-6) ==="
check "X-Request-ID nos SDKs"          "$(grep -c 'X-Request-ID\|x-request-id' $SDK)" 3
check "lastRequestId/last_request_id"  "$(grep -c 'lastRequestId\|last_request_id' $SDK)" 3
check "Idempotency-Key nos SDKs"       "$(grep -c 'Idempotency-Key\|idempotency_key' $SDK)" 3
check "Sunset documentado no spec"     "$(grep -c 'Sunset' $SPEC)" 2
check "ETag nos SDKs (If-None-Match)"  "$(grep -c 'If-None-Match' $SDK)" 3
check "ETag no spec"                   "$(grep -c 'ETag' $SPEC)" 4
check "Response 304 no spec"           "$(grep -c '\"304\"' $SPEC)" 1
check "NotModified component"          "$(grep -c 'NotModified' $SPEC)" 2
check "RateLimit headers no spec"      "$(grep -c 'RateLimit-Limit\|RateLimit-Remaining\|RateLimit-Reset' $SPEC)" 6

echo "=== Invariantes PR-7B (DX Closure) ==="
check "LRU bound (LRUMap/OrderedDict)" "$(grep -c 'LRUMap\|OrderedDict' $SDK)" 2
check "cacheBody opt nos SDKs"         "$(grep -c 'cacheBody\|cache_body' $SDK)" 6
check "RateLimitMetadata exportado"    "$(grep -c 'RateLimitMetadata' $SDK)" 4
check "smoke#8 normalization"          "$(grep -c 'smoke#8\|normalization' $SDK)" 3

echo "=== Invariantes PR-7 invertidos (deprecated → zero) ==="
checkExact "Sem @deprecated em SDKs"          "$(grep -c '@deprecated' $SDK)" 0
checkExact "Sem warnings.warn no Python"      "$(grep -c 'warnings.warn' $SDK)" 0
checkExact "Sem deprecated:true no spec"      "$(grep -c 'deprecated: true\|"deprecated":true' $SPEC)" 0
checkExact "Sem x-sunset no spec"             "$(grep -c 'x-sunset\|xSunset' $SPEC)" 0

echo "=== Invariantes PR-7 negativos (paths removidos não voltam) ==="
checkExact "CP /alterar removido do SDK"      "$(grep -c 'cpAlterar\|/contas-pagar-api/alterar' $SDK)" 0
checkExact "CP /listar removido do SDK"       "$(grep -c 'cpListar\|/contas-pagar-api/listar' $SDK)" 0
checkExact "CP /registrar-pagamento removido" "$(grep -c 'cpRegistrarPagamento\|/contas-pagar-api/registrar-pagamento' $SDK)" 0
checkExact "CP /cancelar-pagamento removido"  "$(grep -c 'cpCancelarPagamento\|/contas-pagar-api/cancelar-pagamento' $SDK)" 0
checkExact "CR /alterar removido"             "$(grep -c 'crAlterar\|/contas-receber-api/alterar' $SDK)" 0
checkExact "CR /listar removido"              "$(grep -c 'crListar\|/contas-receber-api/listar' $SDK)" 0
checkExact "CR /cancelar-recebimento removido" "$(grep -c 'crCancelarRecebimento\|/contas-receber-api/cancelar-recebimento' $SDK)" 0

echo "=== Invariantes PR-7 positivos (canônicos sobreviventes) ==="
check "CP /upsert documentado"               "$(grep -c '/contas-pagar-api/upsert\|cpUpsert' $SPEC)" 1
check "CP /query documentado"                "$(grep -c '/contas-pagar-api/query\|cpQuery' $SPEC)" 1
check "CP /lancar-pagamento documentado"     "$(grep -c '/contas-pagar-api/lancar-pagamento\|cpLancarPagamento' $SPEC)" 1
check "CP /estornar documentado"             "$(grep -c '/contas-pagar-api/estornar\|cpEstornar' $SPEC)" 1
check "CR /upsert documentado"               "$(grep -c '/contas-receber-api/upsert\|crUpsert' $SPEC)" 1
check "CR /lancar-recebimento documentado"   "$(grep -c '/contas-receber-api/lancar-recebimento\|crLancarRecebimento' $SPEC)" 1

echo "=== Versões alinhadas v4.0.0 / v3.0.0 ==="
check "OpenAPI v4.0.0 no spec"               "$(grep -c '\"4.0.0\"' $SPEC)" 1
check "SDK_VERSION 3.0.0"                    "$(grep -c \"3.0.0\" $SDK)" 3
check "APP_VERSION 3.0.0"                    "$(grep -c \"3.0.0\" $VER)" 1

echo
if [ "$fail" -eq 0 ]; then
  echo "ALL OK — invariantes preservados. Pode prosseguir com bump."
  exit 0
else
  echo "REGRESSION DETECTED — corrigir antes de mergear."
  exit 1
fi
