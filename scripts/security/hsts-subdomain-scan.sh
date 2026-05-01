#!/usr/bin/env bash
# =============================================================================
# HSTS subdomain scanner
# -----------------------------------------------------------------------------
# Varre uma lista de subdomínios conhecidos do domínio-alvo e reporta:
#   - Se respondem em HTTPS (status code).
#   - Qual valor de Strict-Transport-Security é servido.
#   - Se o header é compatível com a HSTS preload list:
#       * max-age >= 31536000 (1 ano)
#       * includeSubDomains presente
#       * preload presente
#   - Se o valor é IDÊNTICO ao header canônico do apex (consistência).
#
# Uso:
#   bash scripts/security/hsts-subdomain-scan.sh                    # default: bimaster.online
#   DOMAIN=example.com bash scripts/security/hsts-subdomain-scan.sh
#   DOMAIN=example.com SUBDOMAINS="www api app" bash scripts/security/hsts-subdomain-scan.sh
#
# Variáveis de ambiente:
#   DOMAIN       Domínio apex (default: bimaster.online)
#   SUBDOMAINS   Lista separada por espaços (default: www api app china admin auth cdn portal)
#   TIMEOUT      Timeout do curl em segundos (default: 10)
#   EXPECTED     Valor canônico esperado do HSTS (default: header do apex)
#
# Exit codes:
#   0 — todos os hosts ativos servem HSTS preload-eligible e idêntico ao apex.
#   1 — pelo menos um host ativo falha em algum critério.
#   2 — erro de uso / DOMAIN não resolvível.
# =============================================================================

set -u
set -o pipefail

DOMAIN="${DOMAIN:-bimaster.online}"
SUBDOMAINS="${SUBDOMAINS:-www api app china admin auth cdn portal}"
TIMEOUT="${TIMEOUT:-10}"

# ANSI colors (auto-disable when not a TTY)
if [ -t 1 ]; then
  C_RESET=$'\033[0m'; C_RED=$'\033[31m'; C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'; C_BLUE=$'\033[34m'; C_DIM=$'\033[2m'
else
  C_RESET=""; C_RED=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""; C_DIM=""
fi

ok()    { printf "%s✓%s %s\n" "$C_GREEN"  "$C_RESET" "$*"; }
warn()  { printf "%s⚠%s %s\n" "$C_YELLOW" "$C_RESET" "$*"; }
fail()  { printf "%s✗%s %s\n" "$C_RED"    "$C_RESET" "$*"; }
info()  { printf "%sℹ%s %s\n" "$C_BLUE"   "$C_RESET" "$*"; }
dim()   { printf "%s%s%s\n"   "$C_DIM"    "$*" "$C_RESET"; }

# -----------------------------------------------------------------------------
# fetch_hsts <host>
#   Faz HEAD HTTPS e ecoa: "<status_code>|<hsts_header_value>"
#   - status_code = 000 quando não há resposta.
#   - hsts_header_value vazio quando o header não é servido.
# -----------------------------------------------------------------------------
fetch_hsts() {
  local host="$1"
  local raw status hsts
  raw=$(curl -sS -I -o /tmp/.hsts_body.$$ -w "%{http_code}" \
          --max-time "$TIMEOUT" \
          --connect-timeout "$TIMEOUT" \
          --dump-header /tmp/.hsts_hdr.$$ \
          "https://${host}/" 2>/dev/null) || raw="000"
  status="${raw:-000}"

  if [ -f /tmp/.hsts_hdr.$$ ]; then
    hsts=$(grep -i '^strict-transport-security:' /tmp/.hsts_hdr.$$ \
             | head -1 \
             | sed -E 's/^[Ss]trict-[Tt]ransport-[Ss]ecurity:[[:space:]]*//I' \
             | tr -d '\r\n')
    rm -f /tmp/.hsts_hdr.$$ /tmp/.hsts_body.$$
  else
    hsts=""
  fi

  printf "%s|%s\n" "$status" "$hsts"
}

# -----------------------------------------------------------------------------
# parse_max_age <hsts-value>  →  numeric max-age (or 0 if missing)
# -----------------------------------------------------------------------------
parse_max_age() {
  printf "%s" "$1" \
    | tr ';' '\n' \
    | sed -E 's/^[[:space:]]+|[[:space:]]+$//g' \
    | awk -F= 'tolower($1)=="max-age"{print $2; exit}' \
    | tr -d '"'
}

has_directive() {
  local hsts="$1" needle="$2"
  printf "%s" "$hsts" \
    | tr ';' '\n' \
    | sed -E 's/^[[:space:]]+|[[:space:]]+$//g' \
    | awk -v n="$needle" 'tolower($0)==tolower(n){found=1} END{exit !found}'
}

# -----------------------------------------------------------------------------
# Header canônico (do apex) — define o "esperado" se EXPECTED não foi setado.
# -----------------------------------------------------------------------------
info "Domínio apex: ${C_BLUE}${DOMAIN}${C_RESET}"
APEX_RESULT=$(fetch_hsts "$DOMAIN")
APEX_STATUS="${APEX_RESULT%%|*}"
APEX_HSTS="${APEX_RESULT#*|}"

if [ "$APEX_STATUS" = "000" ]; then
  fail "Apex ${DOMAIN} não respondeu em HTTPS (timeout/erro de conexão)."
  exit 2
fi

EXPECTED="${EXPECTED:-$APEX_HSTS}"

if [ -z "$EXPECTED" ]; then
  warn "Apex respondeu (HTTP ${APEX_STATUS}) mas NÃO serve Strict-Transport-Security."
  warn "Sem valor canônico para comparação — corrija o apex antes de submeter ao preload."
else
  ok "Apex (HTTP ${APEX_STATUS}) HSTS = ${EXPECTED}"
fi

echo
printf "%-40s %-7s %-9s %-9s %-9s %-9s\n" \
  "HOST" "STATUS" "MAX-AGE" "SUBDOMS" "PRELOAD" "MATCH-APEX"
printf "%-40s %-7s %-9s %-9s %-9s %-9s\n" \
  "----------------------------------------" "------" "-------" "-------" "-------" "----------"

EXIT_CODE=0
ALIVE=0
PASSED=0
FAILED_HOSTS=""

# Inclui o próprio apex na varredura
ALL_HOSTS="$DOMAIN"
for sub in $SUBDOMAINS; do
  ALL_HOSTS="$ALL_HOSTS ${sub}.${DOMAIN}"
done

for host in $ALL_HOSTS; do
  result=$(fetch_hsts "$host")
  status="${result%%|*}"
  hsts="${result#*|}"

  if [ "$status" = "000" ]; then
    printf "%-40s %s%-7s%s %-9s %-9s %-9s %-9s\n" \
      "$host" "$C_DIM" "down" "$C_RESET" "-" "-" "-" "-"
    continue
  fi

  ALIVE=$((ALIVE + 1))

  if [ -z "$hsts" ]; then
    printf "%-40s %-7s %s%-9s%s %-9s %-9s %-9s\n" \
      "$host" "$status" "$C_RED" "MISSING" "$C_RESET" "-" "-" "-"
    EXIT_CODE=1
    FAILED_HOSTS="$FAILED_HOSTS $host(no-hsts)"
    continue
  fi

  max_age=$(parse_max_age "$hsts")
  max_age="${max_age:-0}"
  if ! [[ "$max_age" =~ ^[0-9]+$ ]]; then max_age=0; fi

  if [ "$max_age" -ge 31536000 ]; then
    ma_disp="${C_GREEN}${max_age}${C_RESET}"
    ma_ok=1
  else
    ma_disp="${C_RED}${max_age}${C_RESET}"
    ma_ok=0
  fi

  if has_directive "$hsts" "includeSubDomains"; then
    sub_disp="${C_GREEN}yes${C_RESET}"; sub_ok=1
  else
    sub_disp="${C_RED}no${C_RESET}";    sub_ok=0
  fi

  if has_directive "$hsts" "preload"; then
    pre_disp="${C_GREEN}yes${C_RESET}"; pre_ok=1
  else
    pre_disp="${C_RED}no${C_RESET}";    pre_ok=0
  fi

  if [ -n "$EXPECTED" ] && [ "$hsts" = "$EXPECTED" ]; then
    match_disp="${C_GREEN}yes${C_RESET}"; match_ok=1
  elif [ -z "$EXPECTED" ]; then
    match_disp="${C_DIM}n/a${C_RESET}";   match_ok=1
  else
    match_disp="${C_YELLOW}DIFF${C_RESET}"; match_ok=0
  fi

  printf "%-40s %-7s %-18b %-18b %-18b %-18b\n" \
    "$host" "$status" "$ma_disp" "$sub_disp" "$pre_disp" "$match_disp"

  if [ "$ma_ok" = 1 ] && [ "$sub_ok" = 1 ] && [ "$pre_ok" = 1 ] && [ "$match_ok" = 1 ]; then
    PASSED=$((PASSED + 1))
  else
    EXIT_CODE=1
    reason=""
    [ "$ma_ok"    = 0 ] && reason="${reason}max-age<1y,"
    [ "$sub_ok"   = 0 ] && reason="${reason}no-includeSubDomains,"
    [ "$pre_ok"   = 0 ] && reason="${reason}no-preload,"
    [ "$match_ok" = 0 ] && reason="${reason}differs-from-apex,"
    FAILED_HOSTS="$FAILED_HOSTS ${host}(${reason%,})"
  fi
done

echo
info "Hosts respondendo em HTTPS: ${ALIVE}"
info "Hosts preload-eligible e consistentes com apex: ${PASSED}/${ALIVE}"

if [ "$EXIT_CODE" -ne 0 ]; then
  fail "Falhas detectadas:${FAILED_HOSTS}"
  echo
  dim "Critérios de pass:"
  dim "  • max-age >= 31536000 (1 ano)"
  dim "  • includeSubDomains presente"
  dim "  • preload presente"
  dim "  • valor idêntico ao do apex (\$EXPECTED para sobrescrever)"
else
  ok "Todos os hosts ativos atendem aos critérios de HSTS preload."
fi

exit "$EXIT_CODE"
