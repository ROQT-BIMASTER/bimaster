#!/usr/bin/env bash
# E2E Clickjacking / frame-ancestors test
#
# Verifica, para uma ou mais ROTAS do site público:
#   1. Que a rota bloqueia ser carregada em iframe por origens EXTERNAS
#      (clickjacking) — via X-Frame-Options ou CSP frame-ancestors.
#   2. Que origens permitidas (ex.: preview do Lovable) continuam podendo
#      embutir o app.
#
# Configuração via variáveis de ambiente (sem editar o script)
# -----------------------------------------------------------------------------
# Globais (aplicam-se a TODAS as rotas, salvo override por rota):
#   TARGET_URL          Base URL (default: https://bimaster.online)
#   ROUTES              Lista de rotas a testar (CSV ou espaço).
#                       Default: "/" (raiz)
#                       Ex.: "/,/privacidade,/contato,/termos"
#   ROUTES_FILE         Arquivo com uma rota por linha (alternativa a ROUTES)
#   ALLOWED_ORIGINS     Origens permitidas globais (CSV ou espaço)
#   EXTERNAL_ORIGINS    Origens externas (devem ser bloqueadas) globais
#   ALLOWED_ORIGINS_FILE  / EXTERNAL_ORIGINS_FILE  (arquivo, 1 por linha)
#
# Por rota (override; herdam dos globais se ausentes):
#   Sufixo da rota = caminho com '/' e caracteres não-alfanuméricos
#                    convertidos para '_'. Raiz '/' vira 'root'.
#   Ex.: '/privacidade'      -> ALLOWED_ORIGINS__privacidade
#        '/contato'          -> EXTERNAL_ORIGINS__contato
#        '/api/v1/health'    -> ALLOWED_ORIGINS__api_v1_health
#        '/'                 -> ALLOWED_ORIGINS__root
#
#   Variáveis suportadas por rota:
#     ALLOWED_ORIGINS__<sufixo>
#     EXTERNAL_ORIGINS__<sufixo>
#     ALLOWED_ORIGINS_FILE__<sufixo>
#     EXTERNAL_ORIGINS_FILE__<sufixo>
#
# Exemplo:
#   TARGET_URL=https://bimaster.online \
#   ROUTES="/,/privacidade,/contato" \
#   ALLOWED_ORIGINS="https://lovable.dev" \
#   EXTERNAL_ORIGINS="https://evil.example.com" \
#   ALLOWED_ORIGINS__privacidade="https://parceiro.example.com,https://lovable.dev" \
#   EXTERNAL_ORIGINS__contato="https://spam.invalid https://attacker.test" \
#     bash scripts/security/e2e-clickjacking.sh

set -uo pipefail

TARGET_URL="${TARGET_URL:-https://bimaster.online}"
TARGET_URL="${TARGET_URL%/}"  # remove barra final

DEFAULT_ALLOWED_ORIGINS=(
  "https://id-preview--4950000c-e035-4af2-9da5-1b55ef394745.lovable.app"
  "https://lovable.dev"
)
DEFAULT_EXTERNAL_ORIGINS=(
  "https://evil.example.com"
  "https://attacker.test"
  "https://phishing.invalid"
)

# -----------------------------------------------------------------------------
# Parsers
# -----------------------------------------------------------------------------

# parse_csv_var <var_name> <file_var_name>
# Lê env var (CSV ou espaço) e/ou arquivo (1 por linha; '#' = comentário).
# Imprime uma entrada por linha. Vazio se nada definido.
parse_csv_var() {
  local var_name="$1" file_var_name="$2"
  local raw="${!var_name:-}" file="${!file_var_name:-}"
  if [ -n "$file" ] && [ -f "$file" ]; then
    while IFS= read -r line; do
      line="${line%%#*}"
      line="$(echo "$line" | tr -d '[:space:]')"
      [ -n "$line" ] && echo "$line"
    done < "$file"
  fi
  if [ -n "$raw" ]; then
    local normalized
    normalized="$(echo "$raw" | tr ',' ' ')"
    for token in $normalized; do
      [ -n "$token" ] && echo "$token"
    done
  fi
}

# route_suffix </some/path> -> some_path  ('/' -> 'root')
route_suffix() {
  local r="$1"
  if [ "$r" = "/" ] || [ -z "$r" ]; then
    echo "root"
    return
  fi
  # remove barras das pontas, troca não-alfanuméricos por '_'
  r="${r#/}"; r="${r%/}"
  echo "$r" | sed -E 's/[^A-Za-z0-9]+/_/g'
}

# resolve_origins_for_route <route> <ALLOWED|EXTERNAL>
# Resolve a lista efetiva: override por rota se existir, senão global, senão default.
resolve_origins_for_route() {
  local route="$1" kind="$2"
  local suffix; suffix="$(route_suffix "$route")"
  local per_route_var="${kind}_ORIGINS__${suffix}"
  local per_route_file="${kind}_ORIGINS_FILE__${suffix}"
  local global_var="${kind}_ORIGINS"
  local global_file="${kind}_ORIGINS_FILE"

  local out
  out="$(parse_csv_var "$per_route_var" "$per_route_file")"
  if [ -n "$out" ]; then
    echo "$out"
    return
  fi
  out="$(parse_csv_var "$global_var" "$global_file")"
  if [ -n "$out" ]; then
    echo "$out"
    return
  fi
  if [ "$kind" = "ALLOWED" ]; then
    printf '%s\n' "${DEFAULT_ALLOWED_ORIGINS[@]}"
  else
    printf '%s\n' "${DEFAULT_EXTERNAL_ORIGINS[@]}"
  fi
}

# Resolve lista de rotas
mapfile -t ROUTES_LIST < <(parse_csv_var ROUTES ROUTES_FILE)
if [ "${#ROUTES_LIST[@]}" -eq 0 ]; then
  ROUTES_LIST=("/")
fi

# -----------------------------------------------------------------------------
# Output helpers (escopados por rota)
# -----------------------------------------------------------------------------
PASS=0
FAIL=0
TOTAL=0

color() { printf "\033[%sm%s\033[0m" "$1" "$2"; }
ok()   { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "    $(color '32' 'PASS')  $1"; }
bad()  { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "    $(color '31' 'FAIL')  $1"; }
info() { echo "    $(color '36' 'INFO')  $1"; }

# -----------------------------------------------------------------------------
# Helpers de política
# -----------------------------------------------------------------------------
extract_frame_ancestors() {
  echo "$1" | tr ';' '\n' | grep -i 'frame-ancestors' | head -1 \
    | sed -E 's/^[[:space:]]*frame-ancestors[[:space:]]*//I' \
    | tr -s ' ' | sed -E 's/^ +| +$//g'
}

# Args: $1=origin, $2=effective_fa
origin_allowed_by_fa() {
  local origin="$1" fa_lc
  fa_lc=$(echo "$2" | tr '[:upper:]' '[:lower:]')
  [ -z "$fa_lc" ] && return 0
  echo "$fa_lc" | grep -qE "(^|[[:space:]])'?\*'?($|[[:space:]])" && return 0
  local host
  host=$(echo "$origin" | sed -E 's#^https?://##; s#/.*$##')
  echo "$fa_lc" | grep -q "$origin" && return 0
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

# Arg: $1=xfo
origin_blocked_by_xfo() {
  case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
    deny|sameorigin) return 0 ;;
    *) return 1 ;;
  esac
}

# -----------------------------------------------------------------------------
# Teste por rota
# -----------------------------------------------------------------------------
test_route() {
  local route="$1"
  local url="$TARGET_URL"
  case "$route" in
    /*) url="${TARGET_URL}${route}" ;;
    "") url="${TARGET_URL}/" ;;
    *)  url="${TARGET_URL}/${route}" ;;
  esac

  local -a allowed external
  mapfile -t allowed  < <(resolve_origins_for_route "$route" ALLOWED)
  mapfile -t external < <(resolve_origins_for_route "$route" EXTERNAL)

  echo
  echo "----------------------------------------------------------"
  echo " Rota             : $route"
  echo " URL              : $url"
  echo " Allowed origins  : ${allowed[*]}"
  echo " External origins : ${external[*]}"
  echo "----------------------------------------------------------"

  local tmp_h tmp_b
  tmp_h=$(mktemp); tmp_b=$(mktemp)
  local status
  status=$(curl -sSL -o "$tmp_b" -D "$tmp_h" -w "%{http_code}" \
    -A "Mozilla/5.0 (clickjacking-e2e)" "$url")

  if [ "$status" != "200" ]; then
    bad "HTTP status $status (esperado 200) em $url"
    rm -f "$tmp_h" "$tmp_b"
    return
  fi
  ok "HTTP 200 recebido de $url"

  local xfo csp_header csp_meta
  xfo=$(grep -i '^x-frame-options:' "$tmp_h" | tail -1 | tr -d '\r' | sed 's/^[^:]*: *//')
  csp_header=$(grep -i '^content-security-policy:' "$tmp_h" | tail -1 | tr -d '\r' | sed 's/^[^:]*: *//')
  csp_meta=$(grep -oiE '<meta[^>]*http-equiv=["'"'"']content-security-policy["'"'"'][^>]*>' "$tmp_b" \
    | head -1 \
    | sed -E 's/.*content=["'"'"']([^"'"'"']*)["'"'"'].*/\1/I')
  rm -f "$tmp_h" "$tmp_b"

  echo
  echo "  [Políticas detectadas]"
  [ -n "$xfo" ]        && info "X-Frame-Options HTTP: $xfo"        || info "X-Frame-Options HTTP: (ausente)"
  [ -n "$csp_header" ] && info "CSP HTTP             : presente"   || info "CSP HTTP             : (ausente)"
  [ -n "$csp_meta" ]   && info "CSP meta             : $csp_meta"  || info "CSP meta             : (ausente)"

  local fa_header fa_meta effective_fa
  fa_header=$(extract_frame_ancestors "$csp_header")
  fa_meta=$(extract_frame_ancestors "$csp_meta")
  effective_fa="${fa_header:-$fa_meta}"

  echo "  [frame-ancestors efetivo: ${effective_fa:-(nenhum)}]"

  echo
  echo "  [Teste 1: Proteção contra clickjacking presente]"
  if [ -n "$xfo" ] || [ -n "$effective_fa" ]; then
    ok "Pelo menos uma proteção (X-Frame-Options ou frame-ancestors) configurada"
  else
    bad "Nenhuma proteção contra clickjacking detectada — rota EMBUTÍVEL por qualquer origem"
  fi

  echo
  echo "  [Teste 2: Origens externas devem ser BLOQUEADAS]"
  for origin in "${external[@]}"; do
    local b_xfo=false b_fa=false
    origin_blocked_by_xfo "$xfo" && b_xfo=true
    if [ -n "$effective_fa" ]; then
      origin_allowed_by_fa "$origin" "$effective_fa" || b_fa=true
    fi
    if $b_xfo || $b_fa; then
      local reasons=""
      $b_xfo && reasons="${reasons}XFO=$xfo "
      $b_fa  && reasons="${reasons}CSP=frame-ancestors"
      ok "$origin -> bloqueado ($reasons)"
    else
      bad "$origin -> NÃO bloqueado (clickjacking possível)"
    fi
  done

  echo
  echo "  [Teste 3: Origens permitidas devem continuar EMBUTINDO]"
  for origin in "${allowed[@]}"; do
    if origin_blocked_by_xfo "$xfo" && [ "$(echo "$xfo" | tr '[:upper:]' '[:lower:]')" = "deny" ]; then
      bad "$origin -> bloqueado por X-Frame-Options: DENY"
      continue
    fi
    if [ -z "$effective_fa" ]; then
      if origin_blocked_by_xfo "$xfo"; then
        info "$origin -> XFO=$xfo; precisa estar same-origin para embutir"
      else
        ok "$origin -> permitido (sem restrição frame-ancestors)"
      fi
      continue
    fi
    if origin_allowed_by_fa "$origin" "$effective_fa"; then
      ok "$origin -> permitido pela CSP frame-ancestors"
    else
      bad "$origin -> NÃO permitido (preview/iframe legítimo quebrado)"
    fi
  done
}

# -----------------------------------------------------------------------------
# Run
# -----------------------------------------------------------------------------
echo "=========================================================="
echo " Clickjacking / frame-ancestors E2E"
echo " Target base : $TARGET_URL"
echo " Routes      : ${ROUTES_LIST[*]}"
echo "=========================================================="

for route in "${ROUTES_LIST[@]}"; do
  test_route "$route"
done

echo
echo "=========================================================="
printf " RESULT: %s passed, %s failed (of %s)\n" \
  "$(color 32 "$PASS")" "$(color 31 "$FAIL")" "$TOTAL"
echo "=========================================================="

[ "$FAIL" -eq 0 ] || exit 1
exit 0
