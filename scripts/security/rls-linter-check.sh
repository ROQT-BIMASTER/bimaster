#!/usr/bin/env bash
# RLS Linter — flag policies with USING(true) or WITH CHECK(true) on sensitive tables.
#
# Runs against the Supabase project via the Postgres REST-independent SQL admin
# endpoint. In CI, expects DATABASE_URL to point at the project database.
#
# Sensitive-table allowlist: tables that must NEVER expose SELECT with USING (true)
# to `authenticated` or `anon`. Add new tables here as they appear.
#
# Exit codes: 0 = clean, 1 = at least one broad policy detected.

set -u

: "${DATABASE_URL:?defina DATABASE_URL antes de rodar}"

SENSITIVE_TABLES=(
  "parcelas"
  "erp_pedidos_rubysp"
  "estoque_lote_interno"
  "estoque_movimento"
  "estoque_produto_nivel"
  "estoque_unificado_cache"
  "contas_pagar"
  "contas_receber"
  "clientes"
  "fornecedores"
  # our_products: broad SELECT is intentional (public catalog); sensitive columns
  # are protected via column-level GRANTs and covered by
  # e2e-anonymous-sensitive-columns.sh instead.
  "product_comparisons"
  "social_media_metrics_history"
  "user_roles"
  "configuracoes_cobranca"
)

# Build IN(...) list
IN_LIST=$(printf "'%s'," "${SENSITIVE_TABLES[@]}")
IN_LIST="${IN_LIST%,}"

QUERY="SELECT tablename || ' :: ' || policyname || ' :: ' || cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (${IN_LIST})
  AND (
    btrim(coalesce(qual, '')) = 'true'
    OR btrim(coalesce(with_check, '')) = 'true'
  );"

echo "▶ RLS Linter — scanning ${#SENSITIVE_TABLES[@]} sensitive tables for open policies…"
RESULT=$(psql "$DATABASE_URL" -tA -c "$QUERY")

if [[ -n "$RESULT" ]]; then
  echo "❌ Broad policies detected (USING true / WITH CHECK true) on sensitive tables:"
  echo "$RESULT" | sed 's/^/   • /'
  exit 1
fi

echo "✅ No broad SELECT/CHECK policies on the sensitive-table allowlist."
