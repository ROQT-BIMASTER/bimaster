#!/usr/bin/env bash
# audit/regression-greps.sh — invariantes pós-PR-7B (SDK v2.18.1 / OpenAPI v3.9.1 / APP v2.33.1)
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

echo "=== Invariantes herdados ==="
# PR-1/1B: observabilidade (X-Request-ID + lastRequestId)
check "X-Request-ID nos SDKs"          "$(grep -c 'X-Request-ID\|x-request-id' $SDK)" 3
check "lastRequestId/last_request_id"  "$(grep -c 'lastRequestId\|last_request_id' $SDK)" 3

# PR-2: idempotency
check "Idempotency-Key nos SDKs"       "$(grep -c 'Idempotency-Key\|idempotency_key' $SDK)" 3

# PR-4: deprecation/sunset documentado
check "Sunset documentado no spec"     "$(grep -c 'Sunset' $SPEC)" 2

# PR-5: ETag (SDK + spec + 304)
check "ETag nos SDKs (If-None-Match)"  "$(grep -c 'If-None-Match' $SDK)" 3
check "ETag no spec"                   "$(grep -c 'ETag' $SPEC)" 4
check "Response 304 no spec"           "$(grep -c '\"304\"' $SPEC)" 1
check "NotModified component"          "$(grep -c 'NotModified' $SPEC)" 2

# PR-6: rate-limit headers documentados
check "RateLimit headers no spec"      "$(grep -c 'RateLimit-Limit\|RateLimit-Remaining\|RateLimit-Reset' $SPEC)" 6

echo "=== Invariantes PR-7B (DX Closure) ==="
# LRU bound (anti memory-leak)
check "LRU bound (LRUMap/OrderedDict)" "$(grep -c 'LRUMap\|OrderedDict' $SDK)" 2

# cacheBody opt
check "cacheBody opt nos SDKs"         "$(grep -c 'cacheBody\|cache_body' $SDK)" 6

# Tipos exportados
check "RateLimitMetadata exportado"    "$(grep -c 'RateLimitMetadata' $SDK)" 4

# Smoke test de normalização
check "smoke#8 normalization"          "$(grep -c 'smoke#8\|normalization' $SDK)" 3

echo "=== Versões alinhadas ==="
check "OpenAPI v3.9.1 no spec"         "$(grep -c '\"3.9.1\"' $SPEC)" 1
check "APP_VERSION 2.33.1"             "$(grep -c '2.33.1' $VER)" 1

echo
if [ "$fail" -eq 0 ]; then
  echo "ALL OK — invariantes preservados. Pode prosseguir com bump."
  exit 0
else
  echo "REGRESSION DETECTED — corrigir antes de mergear."
  exit 1
fi
