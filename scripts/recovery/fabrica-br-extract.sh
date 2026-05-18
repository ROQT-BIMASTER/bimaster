#!/usr/bin/env bash
# scripts/recovery/fabrica-br-extract.sh
#
# Extrai dados das tabelas Fábrica Brasil de um banco RESTAURADO via PITR
# (anterior a 2026-05-16 01:23 UTC). Não roda em produção — alvo é o DB
# temporário do snapshot.
#
# Uso:
#   RESTORE_DB_URL="postgresql://...restore..." \
#     bash scripts/recovery/fabrica-br-extract.sh
#
# Saída: /tmp/fabrica_br_restore.sql
set -euo pipefail

: "${RESTORE_DB_URL:?defina RESTORE_DB_URL apontando para o snapshot pré-2026-05-16 01:20 UTC}"

OUT="${OUT:-/tmp/fabrica_br_restore.sql}"

TABLES=(
  fabrica_produtos
  fabrica_produtos_historico
  fabrica_produto_grade_itens
  fabrica_produto_visibility_blocks
  fabrica_materias_primas
  fabrica_mp_cotacoes
  fabrica_formulas
  fabrica_formula_itens
  fabrica_formula_versoes
  fabrica_tabelas_preco
  fabrica_tabelas_preco_versoes
  fabrica_tabelas_preco_auditoria
  fabrica_precos_produtos
  fabrica_limites_preco_tabela
  fabrica_markup_overrides
  fabrica_historico_precos
  fabrica_tarefas_ajuste_preco
  fabrica_alertas_precos
  fabrica_produto_custos
  fabrica_insumo_custo_historico
  fabrica_custos_origem
  fabrica_custos_producao
  fabrica_custo_evidencias
  fabrica_acoes_corretivas
  fabrica_ficha_custo_revisoes
  fabrica_ficha_custo_revisao_itens
  fabrica_revisao_requisitos
  fabrica_revisao_mensagens
  fabrica_revisao_documentos
  fabrica_ordens_producao
  fabrica_roteiros_producao
  fabrica_planejamento_necessidades
  fabrica_apontamentos
  fabrica_paradas
  fabrica_lotes
  fabrica_refugos
  fabrica_retrabalhos
  fabrica_inspecoes_qualidade
  fabrica_nao_conformidades
  fabrica_timesheets
  fabrica_processamento_logs
  fabrica_movimentacoes
  fabrica_movimentacoes_estoque
  fabrica_compras
  fabrica_compra_itens
  fabrica_compra_recebimentos
  fabrica_compra_recebimento_itens
  fabrica_notas_fiscais
  fabrica_notas_fiscais_saida
  fabrica_itens_nf
  fabrica_itens_nf_saida
  fabrica_nfe_xmls
  fabrica_apuracao_fiscal
  fabrica_creditos_tributarios
  fabrica_validacoes_fiscais
  fabrica_dados_fiscais_produto
)

TABLE_ARGS=()
for t in "${TABLES[@]}"; do
  TABLE_ARGS+=(--table="public.${t}")
done

echo "==> Snapshot de contagens no DB restaurado:"
SQL_COUNTS=""
for t in "${TABLES[@]}"; do
  SQL_COUNTS+="SELECT '${t}' AS tabela, count(*) FROM public.${t} UNION ALL "
done
SQL_COUNTS="${SQL_COUNTS%UNION ALL } ORDER BY tabela;"
psql "$RESTORE_DB_URL" -c "$SQL_COUNTS" | tee /tmp/fabrica_br_restore_counts_before.txt

echo "==> Extraindo dump para ${OUT} ..."
pg_dump --data-only --no-owner --no-privileges \
  --disable-triggers \
  "${TABLE_ARGS[@]}" \
  "$RESTORE_DB_URL" > "$OUT"

echo "==> Pronto. Dump: ${OUT}"
echo "==> Snapshot de contagens: /tmp/fabrica_br_restore_counts_before.txt"
