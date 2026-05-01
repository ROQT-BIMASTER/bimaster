#!/usr/bin/env bash
# E2E Clickjacking / frame-ancestors test
#
# Verifica:
#   1. Que o site público (bimaster.online) bloqueia ser carregado em iframe
#      por domínios EXTERNOS (clickjacking) — via header HTTP X-Frame-Options
#      ou diretiva CSP frame-ancestors retornada pelo servidor.
#   2. Que origens permitidas (preview do Lovable) continuam podendo
#      embutir o app — checagem por inspeção da política, sem browser.
#
# Notas:
#   - X-Frame-Options só funciona quando enviado como header HTTP (não via meta).
#   - frame-ancestors funciona via header HTTP OU via <meta http-equiv="CSP">,
#     mas neste último caso o navegador precisa baixar a página para avaliar.
#     Por isso, este script faz duas verificações:
#       (a) Inspeciona resposta HTTP (headers e meta CSP no HTML).
#       (b) Valida que a política inclui restrição de frame-ancestors.
#
# Uso:
#   bash scripts/security/e2e-clickjacking.sh
#   TARGET_URL=https://bimaster.online bash scripts/security/e2e-clickjacking.sh

set -uo pipefail

TARGET_URL="${TARGET_URL:-https://bimaster.online}"
ALLOWED_ORIGINS=(
  "https://id-preview--4950000c-e035-4af2-9da5-1b55ef394745.lovable.app"
  "https://lovable.dev"
)
EXTERNAL_ORIGINS=(
  "https://evil.example.com"
  "https://attacker.test"
  "https://phishing.invalid"
)

PASS=0
FAIL=0
TOTAL=0

color() { printf "\033[%sm%s\033[0m" "$1" "$2"; }
ok()   { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "  $(color '32' 'PASS')  $1"; }
bad()  { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "  $(color '31' 'FAIL')  $1"; }
info() { echo "  $(color '36' 'INFO')  $1"; }

echo "=========================================================="
echo " Clickjacking / frame-ancestors E2E"
echo " Target: $TARGET_URL"
echo "=========================================================="

# 1) Coleta resposta
TMP_HEADERS=$(mktemp)
TMP_BODY=$(mktemp)
trap 'rm -f "$TMP_HEADERS" "$TMP_BODY"' EXIT

HTTP_STATUS=$(curl -sSL -o "$TMP_BODY" -D "$TMP_HEADERS" -w "%{http_code}" \
  -A "Mozilla/5.0 (clickjacking-e2e)" "$TARGET_URL")

if [ "$HTTP_STATUS" != "200" ]; then
  bad "HTTP status $HTTP_STATUS (esperado 200)"
  exit 1
fi
ok "HTTP 200 recebido de $TARGET_URL"

# 2) Extrai políticas (header HTTP)
XFO=$(grep -i '^x-frame-options:' "$TMP_HEADERS" | tail -1 | tr -d '\r' | sed 's/^[^:]*: *//')
CSP_HEADER=$(grep -i '^content-security-policy:' "$TMP_HEADERS" | tail -1 | tr -d '\r' | sed 's/^[^:]*: *//')

# 3) Extrai políticas (meta CSP no HTML)
CSP_META=$(grep -oiE '<meta[^>]*http-equiv=["'"'"']content-security-policy["'"'"'][^>]*>' "$TMP_BODY" \
  | head -1 \
  | sed -E 's/.*content=["'"'"']([^"'"'"']*)["'"'"'].*/\1/I')

echo
echo "[Políticas detectadas]"
[ -n "$XFO" ]        && info "X-Frame-Options HTTP: $XFO"        || info "X-Frame-Options HTTP: (ausente)"
[ -n "$CSP_HEADER" ] && info "CSP HTTP             : presente"   || info "CSP HTTP             : (ausente)"
[ -n "$CSP_META" ]   && info "CSP meta             : $CSP_META"  || info "CSP meta             : (ausente)"

# 4) Helper: extrair frame-ancestors de uma CSP
extract_frame_ancestors() {
  echo "$1" | tr ';' '\n' | grep -i 'frame-ancestors' | head -1 \
    | sed -E 's/^[[:space:]]*frame-ancestors[[:space:]]*//I' \
    | tr -s ' ' | sed -E 's/^ +| +$//g'
}

FA_HEADER=$(extract_frame_ancestors "$CSP_HEADER")
FA_META=$(extract_frame_ancestors "$CSP_META")

# Política efetiva: header tem precedência; se ausente, meta vale.
EFFECTIVE_FA="${FA_HEADER:-$FA_META}"

echo
echo "[frame-ancestors efetivo: ${EFFECTIVE_FA:-(nenhum)}]"

# 5) Avalia: deve haver ALGUMA proteção contra clickjacking
echo
echo "[Teste 1: Proteção contra clickjacking presente]"
if [ -n "$XFO" ] || [ -n "$EFFECTIVE_FA" ]; then
  ok "Pelo menos uma proteção (X-Frame-Options ou frame-ancestors) configurada"
else
  bad "Nenhuma proteção contra clickjacking detectada — site EMBUTÍVEL por qualquer origem"
fi

# 6) Avalia cada origem externa
origin_allowed_by_fa() {
  local origin="$1" fa_lc
  fa_lc=$(echo "$EFFECTIVE_FA" | tr '[:upper:]' '[:lower:]')
  [ -z "$fa_lc" ] && return 0   # sem CSP frame-ancestors -> permite
  echo "$fa_lc" | grep -qE "(^|[[:space:]])'?\*'?($|[[:space:]])" && return 0
  local host
  host=$(echo "$origin" | sed -E 's#^https?://##; s#/.*$##')
  # match exato
  echo "$fa_lc" | grep -q "$origin" && return 0
  # match wildcard *.dominio
  for token in $fa_lc; do
    case "$token" in
      https://\*.*)
        local suffix="${token#https://\*.}"
        suffix="${suffix%/}"
        case "$host" in
          *".$suffix") return 0 ;;
        esac
        ;;
    esac
  done
  return 1
}

origin_blocked_by_xfo() {
  case "$(echo "$XFO" | tr '[:upper:]' '[:lower:]')" in
    deny|sameorigin) return 0 ;;
    *) return 1 ;;
  esac
}

echo
echo "[Teste 2: Origens externas devem ser BLOQUEADAS]"
for origin in "${EXTERNAL_ORIGINS[@]}"; do
  blocked_by_xfo=false
  blocked_by_fa=false
  origin_blocked_by_xfo && blocked_by_xfo=true
  if [ -n "$EFFECTIVE_FA" ]; then
    origin_allowed_by_fa "$origin" || blocked_by_fa=true
  fi
  if $blocked_by_xfo || $blocked_by_fa; then
    reasons=""
    $blocked_by_xfo && reasons="${reasons}XFO=$XFO "
    $blocked_by_fa  && reasons="${reasons}CSP=frame-ancestors"
    ok "$origin -> bloqueado ($reasons)"
  else
    bad "$origin -> NÃO bloqueado (clickjacking possível)"
  fi
done

echo
echo "[Teste 3: Origens permitidas devem continuar EMBUTINDO]"
for origin in "${ALLOWED_ORIGINS[@]}"; do
  # Se XFO=DENY, ninguém embute (inclusive Lovable). Avisa, não falha,
  # porque XFO HTTP é set por Cloudflare/host e pode ser legítimo.
  if origin_blocked_by_xfo && [ "$(echo "$XFO" | tr '[:upper:]' '[:lower:]')" = "deny" ]; then
    bad "$origin -> bloqueado por X-Frame-Options: DENY (preview Lovable não funcionará)"
    continue
  fi
  if [ -z "$EFFECTIVE_FA" ]; then
    # Sem CSP frame-ancestors, depende só de XFO
    if origin_blocked_by_xfo; then
      info "$origin -> XFO=$XFO; precisa estar same-origin para embutir"
    else
      ok "$origin -> permitido (sem restrição frame-ancestors)"
    fi
    continue
  fi
  if origin_allowed_by_fa "$origin"; then
    ok "$origin -> permitido pela CSP frame-ancestors"
  else
    bad "$origin -> NÃO permitido (preview/iframe legítimo quebrado)"
  fi
done

echo
echo "=========================================================="
printf " RESULT: %s passed, %s failed (of %s)\n" \
  "$(color 32 "$PASS")" "$(color 31 "$FAIL")" "$TOTAL"
echo "=========================================================="

[ "$FAIL" -eq 0 ] || exit 1
exit 0
