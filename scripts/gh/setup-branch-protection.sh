#!/usr/bin/env bash
# scripts/gh/setup-branch-protection.sh
#
# Aplica regra de proteção no branch `main` de ROQT-BIMASTER/Roqt-Bimaster.
#
# Pré-requisitos:
#   - gh CLI instalado e autenticado (`gh auth login`)
#   - Permissão ADMIN no repositório (necessária para o endpoint
#     `repos/.../branches/<branch>/protection`)
#
# Uso:
#   bash scripts/gh/setup-branch-protection.sh
#   bash scripts/gh/setup-branch-protection.sh --repo ROQT-BIMASTER/Roqt-Bimaster
#   bash scripts/gh/setup-branch-protection.sh --branch main
#
# Notas técnicas:
#   - Os `contexts` em branch-protection-main.json precisam coincidir EXATAMENTE
#     com o `name` do job no workflow YAML. Hoje:
#       typecheck.yml         -> job `typecheck`
#       lint-and-build.yml    -> jobs `lint`, `typecheck-strict`, `build`
#       tests.yml             -> job `vitest`
#     Se renomear um job, atualizar aqui também.
#   - Um status check só pode ser exigido depois de ter rodado ao menos uma vez
#     no branch protegido. Se a chamada falhar com "context not found", abra um
#     PR de no-op para disparar o workflow uma vez e rode este script de novo.
#   - `enforce_admins: false` permite hotfix de admin; promova para `true`
#     quando o time estiver confortável.
#   - `required_linear_history: false` porque o sync Lovable -> GitHub usa
#     merge commits, não rebase.

set -euo pipefail

REPO="ROQT-BIMASTER/Roqt-Bimaster"
BRANCH="main"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)   REPO="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,30p' "$0"; exit 0 ;;
    *)
      echo "Flag desconhecida: $1" >&2; exit 2 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD="$SCRIPT_DIR/branch-protection-main.json"

if ! command -v gh >/dev/null 2>&1; then
  echo "ERRO: gh CLI não encontrado. Instale: https://cli.github.com/" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "ERRO: gh não autenticado. Rode: gh auth login" >&2
  exit 1
fi

if [[ ! -f "$PAYLOAD" ]]; then
  echo "ERRO: payload não encontrado em $PAYLOAD" >&2
  exit 1
fi

echo "Repositório: $REPO"
echo "Branch:      $BRANCH"
echo "Payload:     $PAYLOAD"
echo
echo "Contexts exigidos:"
jq -r '.required_status_checks.contexts[] | "  - " + .' "$PAYLOAD"
echo

read -r -p "Aplicar branch protection? (y/N) " ans
[[ "$ans" =~ ^[Yy]$ ]] || { echo "Cancelado."; exit 0; }

set +e
RESP=$(gh api -X PUT "repos/$REPO/branches/$BRANCH/protection" \
  -H "Accept: application/vnd.github+json" \
  --input "$PAYLOAD" 2>&1)
CODE=$?
set -e

if [[ $CODE -ne 0 ]]; then
  echo "FALHA ao aplicar:" >&2
  echo "$RESP" >&2
  echo >&2
  echo "Causas comuns:" >&2
  echo "  - Falta permissão admin no repo." >&2
  echo "  - Algum context ainda não rodou no branch (veja nota no cabeçalho)." >&2
  exit 1
fi

echo "OK. Branch protection aplicado em $REPO@$BRANCH."
echo "Verifique em: https://github.com/$REPO/settings/branches"
