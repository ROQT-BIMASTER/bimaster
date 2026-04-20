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

echo "=== Versões alinhadas (linha base v3.1.x) — superseded por checks PR-16 ==="
check "OpenAPI v4.x no spec"                 "$(grep -cE '"4\.[0-9]+\.[0-9]+"' $SPEC)" 1
check "SDK_VERSION 3.x"                      "$(grep -cE '3\.[0-9]+\.[0-9]+' $SDK)" 3
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
RPC_LATEST=$(grep -l 'process_payment_atomic' supabase/migrations/*.sql 2>/dev/null | sort | tail -1)
RPC_METODO_COUNT=$( [ -n "$RPC_LATEST" ] && grep -c 'metodo_pagamento' "$RPC_LATEST" 2>/dev/null || echo 0 )
RPC_METODO_COUNT=$(echo "$RPC_METODO_COUNT" | head -1)
checkExact "Migration mais recente do RPC nao usa metodo_pagamento" "$RPC_METODO_COUNT" 0
# 2B: validateReference em handleUpdate.
check      "handleUpdate valida categoria_codigo (PR-13)" "$(grep -cE 'validateReference.*categoria_codigo|categoria_codigo.*validateReference' supabase/functions/_shared/contas-pagar/crud-handlers.ts)" 1
# 2G: handleCancelar devolve bloqueados granulares.
check      "handleCancelar devolve lista bloqueados" "$(grep -c 'bloqueados' supabase/functions/_shared/contas-pagar/crud-handlers.ts)" 3
# Versão bumpada.
APP_315=$(grep -cE "APP_VERSION = '3\.(1\.([5-9]|[1-9][0-9]+)|([2-9]|[1-9][0-9]+)\.[0-9]+)'" src/lib/version.ts || true)
check "APP_VERSION 3.1.5+" "$APP_315" 1

echo "=== Invariantes PR-14 / Onda 3 (v3.1.6) — endpoints avançados CP ==="
# 3E/3F: anexos agora gravados em cp_anexos (payment_attachments inexistente → causa 500).
checkExact "anexo-handlers nao usa payment_attachments (regressão proibida)" "$(grep -c 'payment_attachments' supabase/functions/_shared/contas-pagar/anexo-handlers.ts)" 0
check      "anexo-handlers usa cp_anexos (>=2)" "$(grep -c 'cp_anexos' supabase/functions/_shared/contas-pagar/anexo-handlers.ts)" 2
# 3C: parcelas/sync usa onConflict correto e granularidade de erros.
check      "parcela-handlers onConflict conta_pagar_id,numero_parcela" "$(grep -c "conta_pagar_id,numero_parcela" supabase/functions/_shared/contas-pagar/parcela-handlers.ts)" 1
check      "parcela-handlers usa numero_parcela (coluna real)" "$(grep -c 'numero_parcela' supabase/functions/_shared/contas-pagar/parcela-handlers.ts)" 3
check      "parcela-handlers devolve errosDetalhe granular" "$(grep -c 'errosDetalhe' supabase/functions/_shared/contas-pagar/parcela-handlers.ts)" 2
APP_316=$(grep -cE "APP_VERSION = '3\.(1\.([6-9]|[1-9][0-9]+)|([2-9]|[1-9][0-9]+)\.[0-9]+)'" src/lib/version.ts || true)
check "APP_VERSION 3.1.6+" "$APP_316" 1

echo "=== Invariantes PR-15 / Onda 4 (v3.1.7) — Export API alinhada com contas_pagar ==="
# 4A/4B/4C: fonte oficial da Export API agora é contas_pagar (financial_payment_queue era legado vazio).
check      "export-api consulta contas_pagar (>=3 refs ativas)" "$(grep -c 'from(\"contas_pagar\")' supabase/functions/contas-pagar-export-api/index.ts)" 3
# Regressão proibida: financial_payment_queue não pode mais aparecer em handlers ATIVOS
# (só pode existir em comentário descritivo; checamos zero ocorrências em chamadas .from).
checkExact "export-api nao chama .from(financial_payment_queue)" "$(grep -c 'from(\"financial_payment_queue\")' supabase/functions/contas-pagar-export-api/index.ts)" 0
# 4D/4I: coluna conta_pagar_id NÃO existe em erp_export_queue. Qualquer ref ativa em filtros causa PGRST204.
checkExact "export-api nao filtra por conta_pagar_id em erp_export_queue" "$(grep -E '\.in\("conta_pagar_id"|\.eq\("conta_pagar_id"|conta_pagar_id\.in\.' supabase/functions/contas-pagar-export-api/index.ts | wc -l)" 0
# Uso correto consolidado de payment_queue_id como ID externo do título.
check      "export-api usa payment_queue_id (>=6)" "$(grep -c 'payment_queue_id' supabase/functions/contas-pagar-export-api/index.ts)" 6
APP_317=$(grep -cE "APP_VERSION = '3\.(1\.([7-9]|[1-9][0-9]+)|([2-9]|[1-9][0-9]+)\.[0-9]+)'" src/lib/version.ts || true)
check      "APP_VERSION 3.1.7+" "$APP_317" 1

echo "=== Invariantes PR-16 (SDK v3.2.0 / OpenAPI v4.2.0 / APP v3.1.8) — Padronização final CP ==="
# 11 métodos novos por SDK × 3 linguagens (TS/JS camelCase + Python snake_case).
# TS/JS contam o nome camelCase. Python conta snake_case separadamente.
check "cpExport* nos SDKs TS/JS (10 métodos × 2 = 20)" "$(grep -cE 'cpExportStatus|cpExportPending|cpExportPaid|cpExportCancelled|cpExportBatch|cpExportConfirm|cpExportHistory|cpExportSummary|cpExportReconciliation|cpExportRetryFailed' $SDK)" 20
check "cp_export_* no SDK Python (10 métodos)"        "$(grep -cE 'cp_export_status|cp_export_pending|cp_export_paid|cp_export_cancelled|cp_export_batch|cp_export_confirm|cp_export_history|cp_export_summary|cp_export_reconciliation|cp_export_retry_failed' $SDK)" 10
check "cpUpdate / cp_update nos 3 SDKs"               "$(grep -cE 'cpUpdate\b|cp_update\b' $SDK)" 3
check "SDK_VERSION 3.2.x+"                             "$(grep -cE 'SDK_VERSION = "3\.([2-9]|[1-9][0-9]+)\.' $SDK)" 1
check "OpenAPI v4.x no spec"                          "$(grep -cE '"4\.[2-9]\.[0-9]+"' $SPEC)" 1
APP_318=$(grep -cE "APP_VERSION = '3\.(1\.([8-9]|[1-9][0-9]+)|([2-9]|[1-9][0-9]+)\.[0-9]+)'" $VER || true)
check "APP_VERSION 3.1.8+"                            "$APP_318" 1
checkExact "Sem cpListar reaparecendo nos SDKs"       "$(grep -c 'cpListar' $SDK)" 0
checkExact "Sem /contas-pagar-api/listar nos SDKs"    "$(grep -c '/contas-pagar-api/listar' $SDK)" 0
check "Glossário SDK→banco no header TS"              "$(grep -c 'GLOSSÁRIO SDK→BANCO\|codigo_categoria.*categoria_codigo' $SDK)" 1

echo "=== Invariantes PR-17 (SDK v3.2.1 / OpenAPI v4.3.0 / APP v3.1.9) — Bugfix TS + alinhamento ==="
# BUG CRÍTICO: cpCancelarLote no TS apontava para /cancelar (unitário) — agora /cancelar-lote.
checkExact "TS: nenhum '/contas-pagar-api/cancelar\"' (sem -lote)" "$(grep -cE '\"/contas-pagar-api/cancelar\"' $SDK)" 0
check      "/contas-pagar-api/cancelar-lote em todos SDKs (>=3)"  "$(grep -c '/contas-pagar-api/cancelar-lote' $SDK)" 3
# Paridade Python: cp_anexos_listar usa _cp_dispatch (não _request direto).
checkExact "cp_anexos_listar não usa _request direto"  "$(grep -A2 'def cp_anexos_listar' $SDK | grep -c 'self._request(\"GET\"')" 0
check      "cp_anexos_listar usa _cp_dispatch"         "$(grep -A4 'def cp_anexos_listar' $SDK | grep -c '_cp_dispatch')" 1
# Handlers CR reais (eram 404 em produção).
CR_FILE="supabase/functions/contas-receber-api/index.ts"
CR_QUERY_COUNT=$(grep -cF "endsWith('/query')" "$CR_FILE")
CR_PARCELAS_COUNT=$(grep -cF "endsWith('/parcelas')" "$CR_FILE")
CR_RECEB_COUNT=$(grep -cF "endsWith('/recebimentos')" "$CR_FILE")
check "CR /query handler real"        "$CR_QUERY_COUNT" 1
check "CR /parcelas handler real"     "$CR_PARCELAS_COUNT" 1
check "CR /recebimentos handler real" "$CR_RECEB_COUNT" 1
# OpenAPI: 3 endpoints CR + 2 endpoints fornecedores documentados.
check "OpenAPI documenta CR /query/parcelas/recebimentos"  "$(grep -cE 'contas-receber-api/(query|parcelas|recebimentos)' $SPEC)" 3
check "OpenAPI documenta fornecedores /check e /sync"      "$(grep -cE '/erp-fornecedores-sync/(check|sync)' $SPEC)" 2
# Versões alinhadas.
SPEC_43=$(grep -cE '"4\.([3-9]|[1-9][0-9]+)\.[0-9]+"' $SPEC || true)
SDK_321=$(grep -cE 'SDK_VERSION = "3\.([2-9]|[1-9][0-9]+)\.' $SDK || true)
APP_319=$(grep -cE "APP_VERSION = '3\.(1\.([9]|[1-9][0-9]+)|([2-9]|[1-9][0-9]+)\.[0-9]+)'" $VER || true)
check "OpenAPI v4.3.x no spec"   "$SPEC_43" 1
check "SDK_VERSION 3.2.1+"       "$SDK_321" 1
check "APP_VERSION 3.1.9+"       "$APP_319" 1

echo "=== Invariantes PR-18 (SDK v3.2.2 / OpenAPI v4.3.1 / APP v3.1.10) — Alias backend + spec completa ==="
# Alias /cancelar-lote no router de contas-pagar-api (era 404 em runtime após PR-17).
CP_ROUTER="supabase/functions/contas-pagar-api/index.ts"
ALIAS_COUNT=$(grep -cF "'cancelar-lote:POST': handleCancelar" "$CP_ROUTER")
IDEMP_LOTE=$(grep -cF '"cancelar-lote:POST"' "$CP_ROUTER")
check "Backend: alias 'cancelar-lote:POST' no router CP"  "$ALIAS_COUNT" 1
check "Backend: cancelar-lote:POST em CP_IDEMPOTENT_ROUTES" "$IDEMP_LOTE" 1
# OpenAPI documenta /cancelar-lote (alias) e fornecedores /check + /sync.
check "OpenAPI documenta /cancelar-lote em cpEndpoints" "$(grep -cE 'path: "/cancelar-lote"' $SPEC)" 1
check "OpenAPI documenta fornecedores /check"           "$(grep -cE 'path: "/check"' $SPEC)" 1
check "OpenAPI documenta fornecedores /sync\"" "$(grep -cE 'path: "/sync"' $SPEC)" 1
# Trailing slash fix no generator de paths.
check "Generator OpenAPI: trailing-slash fix"           "$(grep -cF 'ep.path === "/" ? api.basePath' $SPEC)" 1
# Versões PR-18 (flex: aceita 4.3.1+ / 3.2.2+ / 3.1.10+).
SPEC_43X=$(grep -cE '"4\.(3\.[1-9][0-9]*|[4-9]\.[0-9]+|[1-9][0-9]+\.[0-9]+)"' $SPEC || true)
SDK_32X=$(grep -cE 'SDK_VERSION = "3\.2\.([2-9]|[1-9][0-9]+)"' $SDK || true)
APP_311X=$(grep -cE "APP_VERSION = '3\.1\.(1[0-9]|[2-9][0-9]+)'" $VER || true)
check "OpenAPI v4.3.1+"   "$SPEC_43X" 1
check "SDK_VERSION 3.2.2+" "$SDK_32X" 1
check "APP_VERSION 3.1.10+" "$APP_311X" 1

echo "=== Invariantes PR-19 (SDK v3.2.3 / OpenAPI v4.3.2 / APP v3.1.11) — Auditoria de schemas ==="
# Bug fix real: events (EN) → eventos (PT) nos 3 SDKs (TS interface, JS método, Python dataclass).
checkExact "SDK não usa 'events:' (EN — runtime rejeita)" "$(grep -cE '\bevents:' $SDK)" 0
check      "SDK usa 'eventos' (PT) em todos 3 SDKs"        "$(grep -cE '\beventos\b' $SDK)" 6
check      "headers_customizados nos 3 SDKs"               "$(grep -c 'headers_customizados' $SDK)" 3
# Generator method-aware: cpAnexosListar e cpAnexosIncluir após pós-processo de colisão.
check      "Generator: COLLISION_SUFFIX presente"          "$(grep -c 'COLLISION_SUFFIX' $SPEC)" 2
# Schemas órfãos removidos (zero refs originais).
checkExact "FornecedorQuery removido"                      "$(grep -cE 'FornecedorQuery: \{' $SPEC)" 0
checkExact "ContaCorrenteResponse removido"                "$(grep -cE 'ContaCorrenteResponse: \{' $SPEC)" 0
checkExact "PaisResponse/CidadeResponse/BancoResponse removidos" "$(grep -cE '(PaisResponse|CidadeResponse|BancoResponse): \{' $SPEC)" 0
checkExact "ExportPendingResponse/ExportConfirmInput removidos"  "$(grep -cE '(ExportPendingResponse|ExportConfirmInput): \{' $SPEC)" 0
# Versões PR-19 (flex: aceita 4.3.2+ / 3.2.3+ / 3.1.11+).
SPEC_432=$(grep -cE '"4\.(3\.([2-9]|[1-9][0-9]+)|[4-9]\.[0-9]+|[1-9][0-9]+\.[0-9]+)"' $SPEC || true)
SDK_323=$(grep -cE 'SDK_VERSION = "3\.([2-9]|[1-9][0-9]+)\.' $SDK || true)
APP_3111=$(grep -cE "APP_VERSION = '3\.(1\.(1[1-9]|[2-9][0-9]+)|([2-9]|[1-9][0-9]+)\.[0-9]+)'" $VER || true)
check "OpenAPI v4.3.2+"   "$SPEC_432" 1
check "SDK_VERSION 3.2.3+" "$SDK_323" 1
check "APP_VERSION 3.1.11+" "$APP_3111" 1

echo "=== Invariantes PR-20 (SDK v3.2.4 / OpenAPI v4.3.3 / APP v3.1.12) — Auditoria de schemas (4ª passada) ==="
# Bug fix real: ContaCorrentePayload usa nomes canônicos (runtime IGNORA tipo/banco_codigo/agencia/conta).
check "tipo_conta_corrente nos 3 SDKs (TS+JS+PY)" "$(grep -c 'tipo_conta_corrente' $SDK)" 3
check "cCodCCInt nos 3 SDKs (TS+JS+PY)"           "$(grep -c 'cCodCCInt' $SDK)" 3
check "codigo_banco / codigo_agencia nos SDKs"    "$(grep -cE 'codigo_banco|codigo_agencia' $SDK)" 4
# EmpresaInput +7 campos: Python ganha responsavel_nome (era 0).
check "responsavel_nome no SDK Python"            "$(grep -c 'responsavel_nome' $SDK)" 1
check "responsavel_nome / capital_social no spec EmpresaInput" "$(grep -cE 'responsavel_nome|capital_social' $SPEC)" 2
# Schemas órfãos resolvidos via $ref em components.responses.
check "ErrorAuth referenciado via \$ref"          "$(grep -cE '\$ref.*ErrorAuth' $SPEC)" 1
check "ErrorValidation referenciado via \$ref"    "$(grep -cE '\$ref.*ErrorValidation' $SPEC)" 1
check "ErrorRateLimit referenciado via \$ref"     "$(grep -cE '\$ref.*ErrorRateLimit' $SPEC)" 1
# MetaEnvelope mencionado no info.description.
check "MetaEnvelope citado no info.description"   "$(grep -c 'MetaEnvelope' $SPEC)" 2
# Versões PR-20 (use || true para evitar abort com set -e quando count=0).
SPEC_433=$(grep -cE '"4\.(3\.([3-9]|[1-9][0-9]+)|[4-9]\.[0-9]+|[1-9][0-9]+\.[0-9]+)"' $SPEC || true)
SDK_324=$(grep -cE 'SDK_VERSION = "3\.([2-9]|[1-9][0-9]+)\.' $SDK || true)
APP_3112=$(grep -cE "APP_VERSION = '3\.(1\.(1[2-9]|[2-9][0-9]+)|([2-9]|[1-9][0-9]+)\.[0-9]+)'" $VER || true)
check "OpenAPI v4.3.3+"   "$SPEC_433" 1
check "SDK_VERSION 3.2.4+" "$SDK_324" 1
check "APP_VERSION 3.1.12+" "$APP_3112" 1

echo "=== Invariantes PR-21 (OpenAPI v4.3.4 / APP v3.1.13) — Auditoria cosmética final ==="
# ContaCorrenteInput: 5 campos novos no schema OpenAPI.
check      "pix_sn enum em ApiDocumentation.tsx"      "$(grep -c 'pix_sn' $SPEC)" 1
check      "bol_sn enum em ApiDocumentation.tsx"      "$(grep -c 'bol_sn' $SPEC)" 1
check      "numero_conta_corrente no spec"            "$(grep -c 'numero_conta_corrente' $SPEC)" 1
# EmpresaInput: endereco_numero adicionado.
check      "endereco_numero no EmpresaInput (spec)"   "$(grep -c 'endereco_numero' $SPEC)" 1
# ClienteInput: telefone1_ddd removido (negativo — campo declarado como property no spec).
checkExact "telefone1_ddd removido do ClienteInput"   "$(awk '/ClienteInput: \{/,/^    \},/' $SPEC | grep -cE '^\s*telefone1_ddd:')" 0
# IdempotencyHeaders schema removido (orphan).
checkExact "IdempotencyHeaders schema removido"       "$(grep -cE 'IdempotencyHeaders:\s*\{' $SPEC)" 0
# MetaEnvelope wiring efetivo via allOf.
check      "allOf com MetaEnvelope (wiring CP/CR)"    "$(grep -cE 'allOf.*MetaEnvelope|MetaEnvelope.*allOf' $SPEC)" 1
# Versões PR-21 (use || true para evitar abort com set -e quando count=0).
SPEC_434=$(grep -cE '"4\.(3\.([4-9]|[1-9][0-9]+)|[4-9]\.[0-9]+|[1-9][0-9]+\.[0-9]+)"' $SPEC || true)
APP_3113=$(grep -cE "APP_VERSION = '3\.(1\.(1[3-9]|[2-9][0-9]+)|([2-9]|[1-9][0-9]+)\.[0-9]+)'" $VER || true)
check "OpenAPI v4.3.4+"    "$SPEC_434" 1
check "APP_VERSION 3.1.13+" "$APP_3113" 1

echo "=== Invariantes PR-23 (SDK v3.3.0 / OpenAPI v4.4.0 / APP v3.2.0) — Enriquecimento de dados CP ==="
# Fase 1 (bug real): UpsertSchema/IncluirSchema aceitam novos campos persistidos.
TYPES="supabase/functions/_shared/contas-pagar/types.ts"
HANDLERS="supabase/functions/_shared/contas-pagar/crud-handlers.ts"
PAYHANDLERS="supabase/functions/_shared/contas-pagar/payment-handlers.ts"
check "data_emissao em IncluirSchema+UpsertSchema (types.ts)" "$(grep -cE 'data_emissao' $TYPES)" 2
check "numero_documento_fiscal em types.ts (Incluir+Upsert)"  "$(grep -cE 'numero_documento_fiscal' $TYPES)" 2
check "tipo_documento em types.ts (Incluir+Upsert)"           "$(grep -cE 'tipo_documento' $TYPES)" 2
check "codigo_tipo_documento em types.ts (Incluir+Upsert)"    "$(grep -cE 'codigo_tipo_documento' $TYPES)" 2
check "numero_pedido em types.ts"                             "$(grep -cE 'numero_pedido' $TYPES)" 2
# Fase 2 (JOINs): meta_relacionados nas 5 camadas.
check "meta_relacionados em handlers (consultar+query)"       "$(grep -cE 'meta_relacionados' $HANDLERS)" 2
check "meta_relacionados em ApiDocumentation.tsx (OpenAPI)"   "$(grep -cE 'meta_relacionados' $SPEC)" 2
check "meta_relacionados em SDKs (TS+JS+PY)"                  "$(grep -cE 'meta_relacionados|ContaPagarRelacionados' $SDK)" 4
# Fase 3 (campos novos): forma_pagamento enum + codigo_pix.
check "forma_pagamento enum no LancarPagamentoSchema"         "$(grep -cE 'forma_pagamento' $TYPES)" 1
check "forma_pagamento enum no OpenAPI (PagamentoInput/Out)"  "$(grep -cE 'forma_pagamento' $SPEC)" 2
check "forma_pagamento nos SDKs (TS+JS+PY)"                   "$(grep -cE 'forma_pagamento' $SDK)" 6
check "codigo_pix nos SDKs (TS+JS+PY)"                        "$(grep -cE 'codigo_pix' $SDK)" 3
check "codigo_pix no OpenAPI"                                 "$(grep -cE 'codigo_pix' $SPEC)" 2
check "codigo_pix no LancarPagamentoSchema"                   "$(grep -cE 'codigo_pix' $TYPES)" 1
# usuario_nome / conta_corrente JOIN em handleGetPagamentos.
check "usuario_nome enriquecido em payment-handlers"          "$(grep -cE 'usuario_nome' $PAYHANDLERS)" 1
# Migration alterando RPC process_payment_atomic.
PAY_MIG=$(ls supabase/migrations/*.sql 2>/dev/null | xargs grep -lE 'process_payment_atomic' 2>/dev/null | wc -l)
check "Migration referenciando process_payment_atomic"        "$PAY_MIG" 1
# Versões PR-23 (use || true para evitar abort com set -e quando count=0).
SPEC_440=$(grep -cE '"4\.4\.([0-9]|[1-9][0-9]+)"' $SPEC || true)
SDK_330=$(grep -cE 'SDK_VERSION = "3\.3\.([0-9]|[1-9][0-9]+)"' $SDK || true)
APP_320=$(grep -cE "APP_VERSION = '3\.([2-9]|[1-9][0-9]+)\." $VER || true)
check "OpenAPI v4.4.0+"   "$SPEC_440" 1
check "SDK_VERSION 3.3.0+" "$SDK_330" 1
check "APP_VERSION 3.2.0+" "$APP_320" 1

echo "=== Invariantes PR-24 (SDK v3.3.1 / OpenAPI v4.4.1 / APP v3.2.1) — Production Hardening ==="
CP_INDEX="supabase/functions/contas-pagar-api/index.ts"
CP_EXP_INDEX="supabase/functions/contas-pagar-export-api/index.ts"
CP_CRUD="supabase/functions/_shared/contas-pagar/crud-handlers.ts"
CP_PAY="supabase/functions/_shared/contas-pagar/payment-handlers.ts"
CP_PARCELA="supabase/functions/_shared/contas-pagar/parcela-handlers.ts"
CP_ANEXO="supabase/functions/_shared/contas-pagar/anexo-handlers.ts"
# 1. secureHandler ativo nos 2 entrypoints CP.
check      "secureHandler em contas-pagar-api/index.ts"          "$(grep -c 'secureHandler' $CP_INDEX)" 1
check      "secureHandler em contas-pagar-export-api/index.ts"   "$(grep -c 'secureHandler' $CP_EXP_INDEX)" 1
# 2. Webhook estorno emitido (paridade com cancelar).
check      "conta_pagar.estornado emitido no payment-handlers"   "$(grep -c 'conta_pagar.estornado' $CP_PAY)" 1
# 3. Idempotência centralizada — checkIdempotency removido dos handlers de escrita.
checkExact "checkIdempotency removido de crud-handlers"          "$(grep -c 'checkIdempotency(' $CP_CRUD)" 0
checkExact "checkIdempotency removido de payment-handlers"       "$(grep -c 'checkIdempotency(' $CP_PAY)" 0
# 4. RLS pagamentos restrito por empresa (semi-join via EXISTS).
RLS_PAG=$(ls supabase/migrations/*.sql 2>/dev/null | xargs grep -lE 'authenticated_select_pagamentos' 2>/dev/null | wc -l)
check      "Migration RLS pagamentos (semi-join contas_pagar)"   "$RLS_PAG" 1
# 5. meta_relacionados em parcela/anexo handlers.
check      "meta_relacionados em parcela-handlers"               "$(grep -c 'meta_relacionados' $CP_PARCELA)" 1
check      "meta_relacionados em anexo-handlers"                 "$(grep -c 'meta_relacionados' $CP_ANEXO)" 1
# 6. handleUpsertLote usa .upsert PostgREST (batch real, não loop N+1).
check      ".upsert PostgREST em handleUpsertLote (crud-handlers)" "$(grep -cE '\.upsert\(' $CP_CRUD)" 1
# 7. Versões bumpadas PR-24.
SPEC_441=$(grep -cE '"4\.4\.([1-9]|[1-9][0-9]+)"' $SPEC || true)
SDK_331=$(grep -cE 'SDK_VERSION = "3\.3\.([1-9]|[1-9][0-9]+)"' $SDK || true)
APP_321=$(grep -cE "APP_VERSION = '3\.2\.([1-9]|[1-9][0-9]+)'" $VER || true)
check "OpenAPI v4.4.1+"    "$SPEC_441" 1
check "SDK_VERSION 3.3.1+" "$SDK_331" 1
check "APP_VERSION 3.2.1+" "$APP_321" 1

echo
if [ "$fail" -eq 0 ]; then
  echo "ALL OK — invariantes preservados. Pode prosseguir com bump."
  exit 0
else
  echo "REGRESSION DETECTED — corrigir antes de mergear."
  exit 1
fi
