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

echo "=== Versões alinhadas v4.1.0 / v3.1.0 / APP v3.1.2 ==="
check "OpenAPI v4.1.0 no spec"               "$(grep -cF '"4.1.0"' $SPEC)" 1
check "SDK_VERSION 3.1.0"                    "$(grep -cE '3\.1\.0' $SDK)" 3
check "APP_VERSION 3.1.x"                    "$(grep -cE '3\.1\.[2-9]' $VER)" 1

echo "=== Invariantes PR-9 (bugfix patch v3.1.1) ==="
# P0-2/P0-3: contas-correntes-api alinhado ao schema real (descricao/inativo).
checkExact "Sem update({ ativo:..}) em contas-correntes" "$(grep -E 'update\(\{\s*ativo:' supabase/functions/contas-correntes-api/index.ts | wc -l)" 0
checkExact "Sem .eq('ativo' em contas-correntes"         "$(grep -cE '\.eq\(\"ativo\"' supabase/functions/contas-correntes-api/index.ts)" 0
check     "inativo (boolean) usado em contas-correntes"  "$(grep -cE 'inativo' supabase/functions/contas-correntes-api/index.ts)" 3
# P1-1: /conciliar e /desconciliar implementados (não retornam mais 501 placeholder).
checkExact "CR /conciliar sem 501 placeholder" "$(grep -nE '/conciliar.*501|501.*not implemented' supabase/functions/contas-receber-api/index.ts | wc -l)" 0
check     "CR /conciliar implementado real"    "$(grep -cE 'cr_api_conciliar|conta_receber\.conciliada' supabase/functions/contas-receber-api/index.ts)" 2
check     "CR /desconciliar implementado real" "$(grep -cE 'cr_api_desconciliar|conta_receber\.desconciliada' supabase/functions/contas-receber-api/index.ts)" 2
check     "CR API_VERSION 1.3.0"               "$(grep -cF \"API_VERSION = '1.3.0'\" supabase/functions/contas-receber-api/index.ts)" 1
# P1-3: regime_tributario alinhado com varchar(1) do schema.
checkExact "empresas regime_tributario varchar(1)" "$(grep -E 'regime_tributario:\s*z\.string\(\)\.max\(40\)' supabase/functions/empresas-api/index.ts | wc -l)" 0
check     "empresas regime_tributario max(1)"      "$(grep -cE 'regime_tributario:\s*z\.string\(\)\.max\(1\)' supabase/functions/empresas-api/index.ts)" 2
# P1-4: requireUuid helper exportado (hardening 400 vs 500).
check "requireUuid helper exportado" "$(grep -cE 'export function requireUuid' supabase/functions/_shared/validate.ts)" 1
check "isUuid helper exportado"      "$(grep -cE 'export function isUuid'      supabase/functions/_shared/validate.ts)" 1
# P1-5 / P0-1: garantias herdadas (já corrigidas em PR anteriores).
check "X-Request-ID injetado no shared response" "$(grep -cE 'X-Request-ID' supabase/functions/_shared/response.ts)" 3

echo "=== Invariantes PR-10 (bugfix patch v3.1.2) ==="
# BUG-2: coluna observacao adicionada em contas_pagar (handlers já escreviam nela).
check "CP handler escreve observacao"           "$(grep -c 'observacao' supabase/functions/_shared/contas-pagar/crud-handlers.ts)" 2
# /health endpoint público criado.
check "health/index.ts existe"                  "$(test -f supabase/functions/health/index.ts && echo 1 || echo 0)" 1
check "health declara API_VERSION 3.1.2 ou superior" "$(grep -cE '3\.1\.[2-9]' supabase/functions/health/index.ts)" 1
check "health.verify_jwt = false em config"     "$(grep -A1 -F '[functions.health]' supabase/config.toml | grep -c 'verify_jwt = false')" 1
# Triagem PR-10: bugs do laudo QA marcados como falsos positivos no relatório.
check "PR-10 implementation report existe"      "$(test -f docs/fixes-abr26/PR10_TRIAGE.md && echo 1 || echo 0)" 1

echo "=== Invariantes Onda 1 (v3.1.3) ==="
# 1B: validateReference helper criado e usado em CP/CR.
check "validateReference exportado em utils"    "$(grep -cE 'export async function validateReference' supabase/functions/_shared/contas-pagar/utils.ts)" 1
check "validateReference usado em CP handlers"  "$(grep -c 'validateReference' supabase/functions/_shared/contas-pagar/crud-handlers.ts)" 4
# 1A: garantia de que strOrNum continua presente em CP types e CR.
check "strOrNum em CP types"                    "$(grep -c 'strOrNum' supabase/functions/_shared/contas-pagar/types.ts)" 3
check "strOrNum em CR index"                    "$(grep -c 'strOrNum' supabase/functions/contas-receber-api/index.ts)" 3
# 1D: templates do ApiTester atualizados — categoria 2.04.01 e 1.01.02 não devem mais aparecer
# nos endpoints de CP/CR incluir/upsert (ainda podem aparecer em /orcamentos-caixa, que é outro escopo).
checkExact "ApiTester sem 2.04.01 em CP incluir/upsert" "$(grep -E 'contas-pagar-api/(incluir|upsert)' src/components/erp/ApiTester.tsx | grep -c '2.04.01')" 0
checkExact "ApiTester sem 1.01.02 em CR incluir/upsert" "$(grep -E 'contas-receber-api/(incluir|upsert)' src/components/erp/ApiTester.tsx | grep -c '1.01.02')" 0

echo "=== Invariantes PR-12 (v3.1.4) — fix schema drift CP /upsert ==="
# Causa raiz do 500: handler usava codigo_categoria, coluna real é categoria_codigo.
checkExact "CP crud-handlers nao escreve codigo_categoria como coluna" "$(grep -cE '(upsertData|insertData)\.codigo_categoria\s*=' supabase/functions/_shared/contas-pagar/crud-handlers.ts)" 0
check      "CP crud-handlers grava categoria_codigo (incluir + upsert + lote)" "$(grep -cE 'categoria_codigo' supabase/functions/_shared/contas-pagar/crud-handlers.ts)" 3
# validateReference simétrico em handleUpsert + handleUpdate.
check      "validateReference cobre handleUpsert/handleUpdate (>=8 chamadas)" "$(grep -c 'validateReference' supabase/functions/_shared/contas-pagar/crud-handlers.ts)" 8
# Erros PGRST* expostos no router em vez de mascarados como 500 genérico.
check      "Router CP trata PGRST explicitamente" "$(grep -cE 'startsWith.+PGRST' supabase/functions/contas-pagar-api/index.ts)" 1

echo "=== Invariantes PR-13 / Onda 2 (v3.1.5) — ciclo CP completo ==="
# 2C: RPC corrigido — pagamentos.forma_pagamento (real), nunca metodo_pagamento.
# Validação local da migration mais recente: tem que conter forma_pagamento e observacoes (plural).
check      "Alguma migration usa forma_pagamento (RPC fix)" "$(grep -lE 'forma_pagamento' supabase/migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')" 1
checkExact "Migration mais recente do RPC nao usa metodo_pagamento" "$(grep -l 'process_payment_atomic' supabase/migrations/*.sql 2>/dev/null | sort | tail -1 | xargs -r grep -c 'metodo_pagamento' 2>/dev/null || echo 0)" 0
# 2B: validateReference em handleUpdate.
check      "handleUpdate valida categoria_codigo (PR-13)" "$(grep -cE 'validateReference.*categoria_codigo|categoria_codigo.*validateReference' supabase/functions/_shared/contas-pagar/crud-handlers.ts)" 1
# 2G: handleCancelar devolve bloqueados granulares.
check      "handleCancelar devolve lista bloqueados" "$(grep -c 'bloqueados' supabase/functions/_shared/contas-pagar/crud-handlers.ts)" 3
# Versão bumpada.
check "APP_VERSION 3.1.5+" "$(grep -cE 'APP_VERSION = .3\.1\.[5-9].' src/lib/version.ts)" 1

echo "=== Invariantes PR-14 / Onda 3 (v3.1.6) — endpoints avançados CP ==="
# 3E/3F: anexos agora gravados em cp_anexos (payment_attachments inexistente → causa 500).
checkExact "anexo-handlers nao usa payment_attachments (regressão proibida)" "$(grep -c 'payment_attachments' supabase/functions/_shared/contas-pagar/anexo-handlers.ts)" 0
check      "anexo-handlers usa cp_anexos (>=2)" "$(grep -c 'cp_anexos' supabase/functions/_shared/contas-pagar/anexo-handlers.ts)" 2
# 3C: parcelas/sync usa onConflict correto e granularidade de erros.
check      "parcela-handlers onConflict conta_pagar_id,numero_parcela" "$(grep -c "conta_pagar_id,numero_parcela" supabase/functions/_shared/contas-pagar/parcela-handlers.ts)" 1
check      "parcela-handlers usa numero_parcela (coluna real)" "$(grep -c 'numero_parcela' supabase/functions/_shared/contas-pagar/parcela-handlers.ts)" 3
check      "parcela-handlers devolve errosDetalhe granular" "$(grep -c 'errosDetalhe' supabase/functions/_shared/contas-pagar/parcela-handlers.ts)" 2
check "APP_VERSION 3.1.6+" "$(grep -cE 'APP_VERSION = .3\.1\.[6-9].' src/lib/version.ts)" 1

echo
if [ "$fail" -eq 0 ]; then
  echo "ALL OK — invariantes preservados. Pode prosseguir com bump."
  exit 0
else
  echo "REGRESSION DETECTED — corrigir antes de mergear."
  exit 1
fi
