#!/usr/bin/env bash
#
# Roda a matriz E2E de Aprovações localmente para os papéis vendedor e
# supervisor, com reset + seed automáticos por papel e relatório
# consolidado ao final.
#
# Variáveis obrigatórias (export antes de rodar OU coloque num .env.e2e.local
# que será carregado se existir):
#   E2E_BASE_URL
#   SUPABASE_URL
#   SUPABASE_SERVICE_ROLE_KEY
#   E2E_VENDEDOR_EMAIL      / E2E_VENDEDOR_PASSWORD
#   E2E_SUPERVISOR_EMAIL    / E2E_SUPERVISOR_PASSWORD
#
# Uso:
#   bun run e2e:matrix                # roda os dois papéis
#   bun run e2e:matrix vendedor       # roda só vendedor
#   bun run e2e:matrix supervisor     # roda só supervisor
#
set -uo pipefail

# Carrega .env.e2e.local se existir (gitignored).
if [ -f .env.e2e.local ]; then
  # shellcheck disable=SC1091
  set -a; source .env.e2e.local; set +a
fi

ROLES=("vendedor" "supervisor")
if [ "${1:-}" != "" ]; then
  ROLES=("$1")
fi

require_env() {
  if [ -z "${!1:-}" ]; then
    echo "[e2e-matrix] Faltando variável de ambiente: $1" >&2
    exit 2
  fi
}

require_env E2E_BASE_URL
require_env SUPABASE_URL
require_env SUPABASE_SERVICE_ROLE_KEY

ROOT_OUT="playwright-matrix-report"
mkdir -p "$ROOT_OUT"
SUMMARY="$ROOT_OUT/SUMMARY.md"
echo "# E2E Aprovações — execução local da matriz" > "$SUMMARY"
echo "" >> "$SUMMARY"
echo "Gerado em: $(date)" >> "$SUMMARY"
echo "" >> "$SUMMARY"

OVERALL_RC=0

for ROLE in "${ROLES[@]}"; do
  echo ""
  echo "========================================"
  echo "  Papel: $ROLE"
  echo "========================================"

  case "$ROLE" in
    vendedor)
      EMAIL_VAR="E2E_VENDEDOR_EMAIL"; PASS_VAR="E2E_VENDEDOR_PASSWORD" ;;
    supervisor)
      EMAIL_VAR="E2E_SUPERVISOR_EMAIL"; PASS_VAR="E2E_SUPERVISOR_PASSWORD" ;;
    *)
      echo "[e2e-matrix] Papel desconhecido: $ROLE" >&2; exit 2 ;;
  esac
  require_env "$EMAIL_VAR"
  require_env "$PASS_VAR"

  ROLE_OUT="$ROOT_OUT/$ROLE"
  mkdir -p "$ROLE_OUT"

  # 1. Reset (apaga só dados do seed E2E).
  echo "[e2e-matrix] Reset…"
  bun run scripts/seed/e2e-aprovacoes-reset.ts || { echo "[e2e-matrix] reset falhou"; OVERALL_RC=1; continue; }

  # 2. Seed (ownership para o papel atual).
  echo "[e2e-matrix] Seed (ownership=$ROLE)…"
  E2E_TEST_EMAIL="${!EMAIL_VAR}" \
  E2E_SUPERVISOR_EMAIL="${E2E_SUPERVISOR_EMAIL:-}" \
    bun run scripts/seed/e2e-aprovacoes.ts || { echo "[e2e-matrix] seed falhou"; OVERALL_RC=1; continue; }

  # 3a. Smoke tests com retries isolados (default 3 tentativas).
  SMOKE_ATTEMPTS=$(( ${SMOKE_RETRIES:-2} + 1 ))
  echo "[e2e-matrix] Smoke ($ROLE) — até $SMOKE_ATTEMPTS tentativas…"
  SMOKE_RC=1
  for i in $(seq 1 "$SMOKE_ATTEMPTS"); do
    if E2E_BASE_URL="$E2E_BASE_URL" \
       E2E_TEST_EMAIL="${!EMAIL_VAR}" \
       E2E_TEST_PASSWORD="${!PASS_VAR}" \
       E2E_ROLE="$ROLE" \
         bunx playwright test --config=playwright.config.ts \
           --grep @smoke --reporter=list; then
      SMOKE_RC=0; break
    fi
    [ "$i" -lt "$SMOKE_ATTEMPTS" ] && sleep 5
  done

  if [ "$SMOKE_RC" -ne 0 ]; then
    echo "[e2e-matrix] Smoke falhou após $SMOKE_ATTEMPTS tentativas — pulando suíte completa para $ROLE."
    RC=$SMOKE_RC
  else
    # 3b. Suíte completa (exceto smoke).
    echo "[e2e-matrix] Playwright suíte completa ($ROLE)…"
    E2E_BASE_URL="$E2E_BASE_URL" \
    E2E_TEST_EMAIL="${!EMAIL_VAR}" \
    E2E_TEST_PASSWORD="${!PASS_VAR}" \
    E2E_ROLE="$ROLE" \
      bunx playwright test --config=playwright.config.ts --grep-invert @smoke
    RC=$?
  fi

  # 4. Mover artefatos para a pasta do papel.
  rm -rf "$ROLE_OUT/playwright-report" "$ROLE_OUT/test-results"
  [ -d playwright-report ] && mv playwright-report "$ROLE_OUT/playwright-report"
  [ -d test-results ] && mv test-results "$ROLE_OUT/test-results"

  # 5. Relatório consolidado por papel.
  if [ -f "$ROLE_OUT/playwright-report/results.json" ]; then
    bun run scripts/ci/consolidate-playwright-report.ts \
      --results "$ROLE_OUT/playwright-report/results.json" \
      --out "$ROLE_OUT/CONSOLIDATED.md" \
      --role "$ROLE" || true
  fi

  # 6. Detector de flaky (sempre roda — gera FLAKY.md mesmo sem results).
  #    FLAKY_KEEP herda do shell (default 30 no script).
  FLAKY_KEEP="${FLAKY_KEEP:-30}" \
    bun run scripts/ci/detect-flaky-tests.ts \
      --results "$ROLE_OUT/playwright-report/results.json" \
      --history "playwright-history/$ROLE" \
      --role "$ROLE" \
      --run-id "local-$(date +%s)" \
      --out "$ROLE_OUT/FLAKY.md" \
      --keep "${FLAKY_KEEP:-30}" || true

  echo "" >> "$SUMMARY"
  echo "## $ROLE" >> "$SUMMARY"
  echo "" >> "$SUMMARY"
  echo "- Exit code: \`$RC\`" >> "$SUMMARY"
  echo "- Consolidado: \`$ROLE_OUT/CONSOLIDATED.md\`" >> "$SUMMARY"
  echo "- Flaky: \`$ROLE_OUT/FLAKY.md\`" >> "$SUMMARY"
  echo "- HTML report: \`$ROLE_OUT/playwright-report/index.html\`" >> "$SUMMARY"
  echo "- Artefatos brutos: \`$ROLE_OUT/test-results/\`" >> "$SUMMARY"

  if [ "$RC" -ne 0 ]; then OVERALL_RC=1; fi
done

echo ""
echo "========================================"
echo "  Resumo: $SUMMARY"
echo "========================================"
cat "$SUMMARY"

exit "$OVERALL_RC"
