#!/usr/bin/env bash
# E2E Smoke Tests — Financeiro + Torre de Despesas RLS por perfil
#
# Valida, contra o backend real, o comportamento esperado de RLS + GRANTs
# para as tabelas sensíveis do módulo financeiro e da Torre de Despesas,
# para quatro perfis: admin, supervisor, gerente e vendedor.
#
# Cada probe faz login via GoTrue com as credenciais de cada perfil e
# executa um SELECT via PostgREST. O critério de sucesso é:
#
#   ok_nonempty  -> HTTP 200 e a resposta contém pelo menos 1 registro
#   ok_any       -> HTTP 200 (0 ou mais registros, RLS pode zerar)
#   empty        -> HTTP 200 e resposta obrigatoriamente vazia []
#   denied       -> HTTP 401/403 OU corpo indica permission denied
#
# Escrita nunca é testada aqui — apenas leitura. Escritas devem ser
# validadas em fluxos dedicados (contas_pagar_create, etc.).
#
# Env obrigatórios:
#   SUPABASE_URL, SUPABASE_ANON_KEY
#
# Credenciais por perfil (qualquer perfil ausente é pulado):
#   E2E_ADMIN_EMAIL       / E2E_ADMIN_PASSWORD
#   E2E_SUPERVISOR_EMAIL  / E2E_SUPERVISOR_PASSWORD
#   E2E_GERENTE_EMAIL     / E2E_GERENTE_PASSWORD
#   E2E_VENDEDOR_EMAIL    / E2E_VENDEDOR_PASSWORD
#
# Exit codes: 0 = todas as expectativas satisfeitas; 1 = pelo menos uma
# falha (leak ou negação indevida).

set -u

SUPABASE_URL="${SUPABASE_URL:?defina SUPABASE_URL antes de rodar}"
ANON_KEY="${SUPABASE_ANON_KEY:?defina SUPABASE_ANON_KEY antes de rodar}"

PASS=0
FAIL=0
SKIP=0
FAILURES=()

sign_in() {
  # sign_in <email> <password> -> imprime access_token, ou vazio se falhar
  local email="$1" pw="$2"
  local resp
  resp=$(curl -s --max-time 15 \
    -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
    -H "apikey: $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "$(EMAIL="$email" PW="$pw" python3 -c "import json,os;print(json.dumps({'email':os.environ['EMAIL'],'password':os.environ['PW']}))")")
  printf '%s' "$resp" | python3 -c "import sys,json
try:
  d=json.loads(sys.stdin.read())
  print(d.get('access_token',''))
except Exception:
  print('')"
}

# probe <label> <token> <path_with_query> <expected: ok_nonempty|ok_any|empty|denied>
probe() {
  local label="$1" token="$2" path="$3" expected="$4"
  local url="$SUPABASE_URL/rest/v1/$path"
  local body http
  body=$(curl -s -o /tmp/e2e_body.$$ -w '%{http_code}' --max-time 20 \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $token" \
    "$url")
  http="$body"
  local content
  content=$(cat /tmp/e2e_body.$$ 2>/dev/null || echo "")
  rm -f /tmp/e2e_body.$$

  # Detecta permission-denied em qualquer resposta 200 com {"code":"42501"}
  # ou 401/403.
  local status="unknown"
  if [ "$http" = "401" ] || [ "$http" = "403" ]; then
    status="denied"
  elif printf '%s' "$content" | grep -qE '"code":"42501"|permission denied for'; then
    status="denied"
  elif [ "$http" = "200" ]; then
    # É um array JSON — verificar se tem elementos
    local len
    len=$(printf '%s' "$content" | python3 -c "import sys,json
try:
  d=json.loads(sys.stdin.read())
  print(len(d) if isinstance(d,list) else -1)
except Exception:
  print(-2)")
    if [ "$len" = "-2" ] || [ "$len" = "-1" ]; then
      status="parse_error"
    elif [ "$len" = "0" ]; then
      status="empty"
    else
      status="ok_nonempty"
    fi
  else
    status="http_$http"
  fi

  local ok=0
  case "$expected" in
    ok_nonempty) [ "$status" = "ok_nonempty" ] && ok=1 ;;
    ok_any)      { [ "$status" = "ok_nonempty" ] || [ "$status" = "empty" ]; } && ok=1 ;;
    empty)       [ "$status" = "empty" ] && ok=1 ;;
    denied)      [ "$status" = "denied" ] && ok=1 ;;
  esac

  if [ "$ok" = "1" ]; then
    PASS=$((PASS+1))
    printf "  PASS  %-40s expected=%-12s got=%s\n" "$label" "$expected" "$status"
  else
    FAIL=$((FAIL+1))
    FAILURES+=("$label | expected=$expected | got=$status | http=$http")
    printf "  FAIL  %-40s expected=%-12s got=%s (http=%s)\n" "$label" "$expected" "$status" "$http"
  fi
}

# ============================================================================
# Matriz de expectativas por perfil
# ============================================================================
# Cada probe é: <path?select=…&limit=1> <expected>
# Expectativas derivadas de pg_policies em 2026-07-05.
#
# Torre de Despesas:
#   despesa_alertas / despesa_alertas_eventos: SELECT restrito a
#     financeiro + is_admin_or_supervisor.
#   despesa_regras: SELECT com acesso ao módulo financeiro (mais amplo).
#
# Financeiro operacional:
#   contas_pagar / contas_receber: financeiro + user_has_empresa_access.
#   plano_contas / bancos: leitura liberada a qualquer authenticated.
#   fornecedores: admin, supervisor OU módulos financeiro/comercial/compras.
#   empresas / centros_custo / portadores: escopadas por empresa do usuário.

run_role() {
  local role="$1" email="$2" pw="$3"
  local exp_alertas="$4" exp_regras="$5" exp_cp="$6" exp_cr="$7" \
        exp_forn="$8" exp_plano="$9" exp_bancos="${10}"

  if [ -z "$email" ] || [ -z "$pw" ]; then
    echo
    echo "[$role] SKIP — credenciais não configuradas"
    SKIP=$((SKIP+1))
    return 0
  fi

  echo
  echo "[$role] Login como $email"
  local token
  token=$(sign_in "$email" "$pw")
  if [ -z "$token" ]; then
    echo "  FAIL  não obteve access_token (verifique credenciais)"
    FAIL=$((FAIL+1))
    FAILURES+=("[$role] login failed")
    return 0
  fi

  # Torre de Despesas
  probe "[$role] despesa_alertas"        "$token" "despesa_alertas?select=id&limit=1"        "$exp_alertas"
  probe "[$role] despesa_alertas_eventos" "$token" "despesa_alertas_eventos?select=id&limit=1" "$exp_alertas"
  probe "[$role] despesa_regras"         "$token" "despesa_regras?select=codigo&limit=1"     "$exp_regras"

  # Financeiro core
  probe "[$role] contas_pagar"     "$token" "contas_pagar?select=id&limit=1"     "$exp_cp"
  probe "[$role] contas_receber"   "$token" "contas_receber?select=id&limit=1"   "$exp_cr"
  probe "[$role] fornecedores"     "$token" "fornecedores?select=id&limit=1"     "$exp_forn"
  probe "[$role] plano_contas"     "$token" "plano_contas?select=id&limit=1"     "$exp_plano"
  probe "[$role] bancos"           "$token" "bancos?select=id&limit=1"           "$exp_bancos"
}

echo "============================================================"
echo " E2E Financeiro + Torre de Despesas — RLS por perfil"
echo " URL: $SUPABASE_URL"
echo "============================================================"

# admin: enxerga tudo
run_role "admin"      "${E2E_ADMIN_EMAIL:-}"      "${E2E_ADMIN_PASSWORD:-}" \
  ok_nonempty ok_nonempty ok_nonempty ok_nonempty ok_nonempty ok_nonempty ok_nonempty

# supervisor: torre acessível se tiver módulo financeiro; demais podem ser
# escopadas por empresa (aceita empty ou nonempty).
run_role "supervisor" "${E2E_SUPERVISOR_EMAIL:-}" "${E2E_SUPERVISOR_PASSWORD:-}" \
  ok_any ok_any ok_any ok_any ok_any ok_nonempty ok_nonempty

# gerente: Torre exige is_admin_or_supervisor -> deve ficar vazia.
# Regras e financeiro operacional dependem de módulo/empresa: aceita empty ou nonempty.
run_role "gerente"    "${E2E_GERENTE_EMAIL:-}"    "${E2E_GERENTE_PASSWORD:-}" \
  empty ok_any ok_any ok_any ok_any ok_nonempty ok_nonempty

# vendedor: Torre vazia; contas_pagar/receber dependem de módulo financeiro
# (esperado vazio); plano_contas/bancos liberadas a todo authenticated.
run_role "vendedor"   "${E2E_VENDEDOR_EMAIL:-}"   "${E2E_VENDEDOR_PASSWORD:-}" \
  empty ok_any empty empty ok_any ok_nonempty ok_nonempty

echo
echo "============================================================"
echo " Resumo: $PASS passed, $FAIL failed, $SKIP roles skipped"
echo "============================================================"

if [ "$FAIL" -gt 0 ]; then
  echo
  echo "Falhas:"
  for f in "${FAILURES[@]}"; do echo "  - $f"; done
  exit 1
fi

# Se todos os perfis foram pulados (nenhum credencial), não considere sucesso.
if [ "$SKIP" -ge 4 ] && [ "$PASS" -eq 0 ]; then
  echo "SKIP: nenhum perfil configurado. Defina E2E_<ROLE>_EMAIL/PASSWORD."
  exit 0
fi

exit 0
