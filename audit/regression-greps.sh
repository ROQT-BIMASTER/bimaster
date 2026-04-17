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

echo "=== Invariantes PR-8 (DX Hardening v3.1.0) ==="
check "verifyWebhookSignature nos 3 SDKs" "$(grep -c 'verifyWebhookSignature\|verify_webhook_signature' $SDK)" 6
check "JS HuggsRateLimitError exportada"  "$(grep -c 'class HuggsRateLimitError' $SDK)" 2
check "JS HuggsConflictError exportada"   "$(grep -c 'class HuggsConflictError' $SDK)" 2
check "JS HuggsBusinessError exportada"   "$(grep -c 'class HuggsBusinessError' $SDK)" 2
check "getCacheStats nos SDKs"            "$(grep -c 'getCacheStats\|get_cache_stats' $SDK)" 3
check "clearCache nos SDKs"               "$(grep -c 'clearCache\|clear_cache' $SDK)" 3
check "Matriz cobertura referenciada"     "$(grep -c 'SDK_COVERAGE_MATRIX' $SDK)" 1

echo "=== Invariantes PR-7 invertidos (deprecated → zero) ==="
# Excluem linhas de comentário/changelog descritivo. Caçam apenas referências ATIVAS de código.
checkExact "Sem @deprecated ativo em SDKs"    "$(grep -E '^\s*\*\s*@deprecated|JSDoc.*@deprecated[^ ]' $SDK | grep -v 'zerado\|eliminados\|grep -c' | wc -l)" 0
checkExact "Sem warnings.warn ativo Python"   "$(grep -nE 'warnings\.warn\(' $SDK | grep -v 'eliminados\|comment\|changelog' | wc -l)" 0
checkExact "Sem deprecated:true ativo"        "$(grep -E '"deprecated":\s*true|deprecated:\s*true,' $SPEC | grep -v '//\|deletadas\|marcados\|grep' | wc -l)" 0
checkExact "Sem x-sunset ativo no spec"       "$(grep -nE '"x-sunset"|xSunset:' $SPEC | grep -v '//\|grep -c\|generator\|defensivo\|ganham deprecated\|operation\[\"x-sunset\"\] = ' | wc -l)" 0

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

echo "=== Invariantes PR-7 DOCS PATCH (markdown sem rotas removidas) ==="
checkExact "API_CONTAS_PAGAR.md sem /listar"      "$(grep -E '/contas-pagar-api/listar|cpListar|cpRegistrarPagamento' docs/API_CONTAS_PAGAR.md | grep -vE '^\|.*[0-9]\.[0-9]\.[0-9]|BREAKING.*removidos|Changelog' | wc -l)" 0
checkExact "API_CONTAS_PAGAR.md sem /alterar"     "$(grep -E '/contas-pagar-api/alterar|cpAlterar' docs/API_CONTAS_PAGAR.md | grep -vE 'substitui|removido|legado' | wc -l)" 0
checkExact "API_CONTAS_PAGAR.md sem /cancelar-pagamento ativo" "$(grep -E '/contas-pagar-api/cancelar-pagamento|cpCancelarPagamento' docs/API_CONTAS_PAGAR.md | grep -vE 'substitui|removido|legado|BREAKING' | wc -l)" 0
checkExact "API_CONTAS_RECEBER.md sem /listar"    "$(grep -E '/contas-receber-api/listar|crListar' docs/API_CONTAS_RECEBER.md | grep -vE 'substitui|removido|BREAKING' | wc -l)" 0
checkExact "API_CONTAS_RECEBER.md sem /alterar"   "$(grep -E '/contas-receber-api/alterar|crAlterar' docs/API_CONTAS_RECEBER.md | grep -vE 'substitui|removido|legado' | wc -l)" 0
checkExact "API_CONTAS_RECEBER.md sem /cancelar-recebimento ativo" "$(grep -E '/contas-receber-api/cancelar-recebimento|crCancelarRecebimento' docs/API_CONTAS_RECEBER.md | grep -vE 'substitui|removido|legado|BREAKING' | wc -l)" 0

echo "=== Versões alinhadas v4.0.0 / v3.0.0 / APP v3.0.1 ==="
check "OpenAPI v4.0.0 no spec"               "$(grep -cF '"4.0.0"' $SPEC)" 1
check "SDK_VERSION 3.0.0"                    "$(grep -cE '3\.0\.0' $SDK)" 3
check "APP_VERSION 3.0.1"                    "$(grep -cE '3\.0\.1' $VER)" 1

echo
if [ "$fail" -eq 0 ]; then
  echo "ALL OK — invariantes preservados. Pode prosseguir com bump."
  exit 0
else
  echo "REGRESSION DETECTED — corrigir antes de mergear."
  exit 1
fi
