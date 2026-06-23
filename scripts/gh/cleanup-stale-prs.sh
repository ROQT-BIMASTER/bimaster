#!/usr/bin/env bash
# scripts/gh/cleanup-stale-prs.sh
#
# Lista e (com --apply) limpa branches órfãos de PRs antigos em
# ROQT-BIMASTER/Roqt-Bimaster.
#
# Pré-requisitos:
#   - gh CLI instalado e autenticado (`gh auth login`)
#   - jq instalado
#   - Permissão WRITE no repo (necessária para deletar refs)
#
# Comportamento:
#   - Dry-run por padrão (não deleta nada).
#   - Lista PRs FECHADOS há mais de --days-closed dias (default 30) cujo
#     head branch ainda existe no repo, exceto branches protegidos
#     (main, dev, release/*).
#   - Lista PRs ABERTOS sem atividade há mais de --days-stale dias
#     (default 60) E sem label "keep-open" — apenas como aviso.
#     NÃO fecha PRs abertos automaticamente.
#   - Com --apply, deleta as refs dos branches órfãos (após confirmação).
#
# Uso:
#   bash scripts/gh/cleanup-stale-prs.sh                  # dry-run
#   bash scripts/gh/cleanup-stale-prs.sh --apply          # aplica deleções
#   bash scripts/gh/cleanup-stale-prs.sh --days-closed 14 --days-stale 30
#   bash scripts/gh/cleanup-stale-prs.sh --repo other/repo

set -euo pipefail

REPO="ROQT-BIMASTER/Roqt-Bimaster"
DAYS_CLOSED=30
DAYS_STALE=60
APPLY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply)         APPLY=1; shift ;;
    --days-closed)   DAYS_CLOSED="$2"; shift 2 ;;
    --days-stale)    DAYS_STALE="$2"; shift 2 ;;
    --repo)          REPO="$2"; shift 2 ;;
    -h|--help)       sed -n '2,28p' "$0"; exit 0 ;;
    *) echo "Flag desconhecida: $1" >&2; exit 2 ;;
  esac
done

command -v gh >/dev/null 2>&1 || { echo "ERRO: gh CLI não instalado." >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "ERRO: jq não instalado." >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "ERRO: gh não autenticado." >&2; exit 1; }

# Cutoff dates em ISO-8601 (UTC).
CUTOFF_CLOSED=$(date -u -d "$DAYS_CLOSED days ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
  || date -u -v "-${DAYS_CLOSED}d" +%Y-%m-%dT%H:%M:%SZ)
CUTOFF_STALE=$(date -u -d "$DAYS_STALE days ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
  || date -u -v "-${DAYS_STALE}d" +%Y-%m-%dT%H:%M:%SZ)

echo "Repo:                $REPO"
echo "Modo:                $([[ $APPLY -eq 1 ]] && echo APPLY || echo DRY-RUN)"
echo "PRs fechados desde:  antes de $CUTOFF_CLOSED ($DAYS_CLOSED dias)"
echo "PRs abertos stale:   sem atividade desde $CUTOFF_STALE ($DAYS_STALE dias)"
echo

protected_branch() {
  # Retorna 0 se o branch for protegido (não deletar).
  case "$1" in
    main|master|dev|develop) return 0 ;;
    release/*|hotfix/*)      return 0 ;;
    *) return 1 ;;
  esac
}

# ----- PRs fechados antigos com branch ainda vivo -----
echo "=== PRs fechados há mais de $DAYS_CLOSED dias (branch ainda existe) ==="
mapfile -t CLOSED < <(
  gh pr list --repo "$REPO" --state closed --limit 500 \
    --json number,title,closedAt,headRefName,headRepository,author,isCrossRepository \
  | jq -r --arg cutoff "$CUTOFF_CLOSED" '
      .[]
      | select(.closedAt < $cutoff)
      | select(.isCrossRepository == false)
      | "\(.number)\t\(.headRefName)\t\(.closedAt)\t\(.author.login)\t\(.title)"
    '
)

ORPHAN_BRANCHES=()
if [[ ${#CLOSED[@]} -eq 0 ]]; then
  echo "  (nenhum)"
else
  printf "%-6s %-40s %-22s %-20s %s\n" "PR#" "BRANCH" "CLOSED_AT" "AUTHOR" "TITLE"
  for row in "${CLOSED[@]}"; do
    IFS=$'\t' read -r num branch closed author title <<<"$row"
    if protected_branch "$branch"; then
      continue
    fi
    # Verifica se ref ainda existe.
    if gh api "repos/$REPO/git/refs/heads/$branch" >/dev/null 2>&1; then
      printf "%-6s %-40s %-22s %-20s %s\n" \
        "#$num" "$branch" "$closed" "$author" "${title:0:60}"
      ORPHAN_BRANCHES+=("$branch")
    fi
  done
fi
echo

# ----- PRs abertos stale (somente aviso) -----
echo "=== PRs ABERTOS sem atividade há mais de $DAYS_STALE dias (sem label keep-open) ==="
gh pr list --repo "$REPO" --state open --limit 500 \
  --json number,title,updatedAt,headRefName,author,labels \
| jq -r --arg cutoff "$CUTOFF_STALE" '
    .[]
    | select(.updatedAt < $cutoff)
    | select(([.labels[].name] | index("keep-open")) == null)
    | "  #\(.number)  \(.updatedAt)  @\(.author.login)  \(.title)"
  ' || true
echo
echo "  (PRs abertos NÃO são fechados automaticamente — review manual)"
echo

# ----- Apply -----
if [[ $APPLY -eq 0 ]]; then
  echo "Dry-run. Para aplicar deleções de branches órfãos, rode com --apply."
  exit 0
fi

if [[ ${#ORPHAN_BRANCHES[@]} -eq 0 ]]; then
  echo "Nada a deletar."
  exit 0
fi

echo "Branches a deletar (${#ORPHAN_BRANCHES[@]}):"
printf '  - %s\n' "${ORPHAN_BRANCHES[@]}"
read -r -p "Confirmar deleção? (y/N) " ans
[[ "$ans" =~ ^[Yy]$ ]] || { echo "Cancelado."; exit 0; }

FAIL=0
for branch in "${ORPHAN_BRANCHES[@]}"; do
  if gh api -X DELETE "repos/$REPO/git/refs/heads/$branch" >/dev/null 2>&1; then
    echo "  deleted: $branch"
  else
    echo "  FAILED:  $branch" >&2
    FAIL=$((FAIL + 1))
  fi
done

echo
echo "Concluído. Falhas: $FAIL"
exit $FAIL
