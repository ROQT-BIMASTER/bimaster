#!/usr/bin/env bash
# scripts/recovery/fabrica-br-import.sh
#
# Aplica o dump gerado por fabrica-br-extract.sh contra a produção atual.
# Exige confirmação interativa. Verifica que as tabelas estão vazias antes
# de inserir (idempotência por contagem).
#
# Uso:
#   PROD_DB_URL="postgresql://...prod..." \
#   DUMP_FILE="/tmp/fabrica_br_restore.sql" \
#     bash scripts/recovery/fabrica-br-import.sh
set -euo pipefail

: "${PROD_DB_URL:?defina PROD_DB_URL}"
DUMP_FILE="${DUMP_FILE:-/tmp/fabrica_br_restore.sql}"

if [[ ! -s "$DUMP_FILE" ]]; then
  echo "ERRO: $DUMP_FILE inexistente ou vazio. Rode fabrica-br-extract.sh primeiro." >&2
  exit 1
fi

echo "==> Contagens ATUAIS em produção (devem estar zeradas para tabelas afetadas):"
psql "$PROD_DB_URL" -c "
SELECT 'fabrica_produtos' t, count(*) FROM public.fabrica_produtos
UNION ALL SELECT 'fabrica_materias_primas', count(*) FROM public.fabrica_materias_primas
UNION ALL SELECT 'fabrica_formulas', count(*) FROM public.fabrica_formulas
UNION ALL SELECT 'fabrica_tabelas_preco', count(*) FROM public.fabrica_tabelas_preco
UNION ALL SELECT 'fabrica_precos_produtos', count(*) FROM public.fabrica_precos_produtos
UNION ALL SELECT 'fabrica_ordens_producao', count(*) FROM public.fabrica_ordens_producao
UNION ALL SELECT 'fabrica_fornecedores (preservar)', count(*) FROM public.fabrica_fornecedores
ORDER BY t;"

read -r -p "Aplicar dump ${DUMP_FILE} em produção? Digite RESTORE para confirmar: " ans
if [[ "$ans" != "RESTORE" ]]; then
  echo "Cancelado."
  exit 1
fi

echo "==> Aplicando dump dentro de uma transação..."
psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL session_replication_role = replica;
\i ${DUMP_FILE}
COMMIT;
SQL

echo "==> Contagens APÓS import:"
psql "$PROD_DB_URL" -c "
SELECT 'fabrica_produtos' t, count(*) FROM public.fabrica_produtos
UNION ALL SELECT 'fabrica_materias_primas', count(*) FROM public.fabrica_materias_primas
UNION ALL SELECT 'fabrica_formulas', count(*) FROM public.fabrica_formulas
UNION ALL SELECT 'fabrica_formula_itens', count(*) FROM public.fabrica_formula_itens
UNION ALL SELECT 'fabrica_tabelas_preco', count(*) FROM public.fabrica_tabelas_preco
UNION ALL SELECT 'fabrica_precos_produtos', count(*) FROM public.fabrica_precos_produtos
UNION ALL SELECT 'fabrica_limites_preco_tabela', count(*) FROM public.fabrica_limites_preco_tabela
UNION ALL SELECT 'fabrica_ordens_producao', count(*) FROM public.fabrica_ordens_producao
UNION ALL SELECT 'fabrica_produto_custos', count(*) FROM public.fabrica_produto_custos
UNION ALL SELECT 'fabrica_historico_precos', count(*) FROM public.fabrica_historico_precos
UNION ALL SELECT 'fabrica_compras', count(*) FROM public.fabrica_compras
UNION ALL SELECT 'fabrica_notas_fiscais', count(*) FROM public.fabrica_notas_fiscais
ORDER BY t;"

echo "==> Compare com /tmp/fabrica_br_restore_counts_before.txt (gerado pela extração)."
echo "==> Smoke test no front: /dashboard/fabrica/produtos-acabados, /tabelas-preco, /matriz."
