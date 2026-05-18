# Incidente — Perda de dados Fábrica Brasil (2026-05-16)

## Resumo
A migration `supabase/migrations/20260516012327_27afd69a-5146-41b7-93c7-94767d668835.sql`, aplicada em **2026-05-16 ~01:23 UTC**, foi escrita com o objetivo de zerar apenas o módulo China, mas inclui um segundo bloco que executa `DELETE FROM` em toda a cadeia do Fábrica Brasil. O resultado foi a perda total de produtos acabados, matérias-primas, fórmulas, tabelas de preço, ordens de produção, custos, NFs, compras, históricos e auditorias do módulo Fábrica Brasil.

## Impacto
Tabelas com `count(*) = 0` confirmadas em 2026-05-18 13:55 UTC:

- `fabrica_produtos`, `fabrica_produtos_historico`, `fabrica_produto_grade_itens`, `fabrica_produto_visibility_blocks`
- `fabrica_materias_primas`, `fabrica_mp_cotacoes`
- `fabrica_formulas`, `fabrica_formula_itens`, `fabrica_formula_versoes`
- `fabrica_tabelas_preco`, `fabrica_tabelas_preco_versoes`, `fabrica_tabelas_preco_auditoria`, `fabrica_precos_produtos`, `fabrica_limites_preco_tabela`, `fabrica_markup_overrides`, `fabrica_historico_precos`, `fabrica_tarefas_ajuste_preco`, `fabrica_alertas_precos`
- `fabrica_produto_custos`, `fabrica_insumo_custo_historico`, `fabrica_custos_origem`, `fabrica_custos_producao`, `fabrica_custo_evidencias`, `fabrica_acoes_corretivas`
- `fabrica_ficha_custo_revisoes`, `fabrica_ficha_custo_revisao_itens`, `fabrica_revisao_requisitos`, `fabrica_revisao_mensagens`, `fabrica_revisao_documentos`
- `fabrica_ordens_producao`, `fabrica_roteiros_producao`, `fabrica_planejamento_necessidades`, `fabrica_apontamentos`, `fabrica_paradas`, `fabrica_lotes`, `fabrica_refugos`, `fabrica_retrabalhos`, `fabrica_inspecoes_qualidade`, `fabrica_nao_conformidades`, `fabrica_timesheets`, `fabrica_processamento_logs`
- `fabrica_movimentacoes`, `fabrica_movimentacoes_estoque`
- `fabrica_compras`, `fabrica_compra_itens`, `fabrica_compra_recebimentos`, `fabrica_compra_recebimento_itens`
- `fabrica_notas_fiscais`, `fabrica_notas_fiscais_saida`, `fabrica_itens_nf`, `fabrica_itens_nf_saida`, `fabrica_nfe_xmls`
- `fabrica_apuracao_fiscal`, `fabrica_creditos_tributarios`, `fabrica_validacoes_fiscais`, `fabrica_dados_fiscais_produto`

Sobreviveram: `fabrica_fornecedores` (5 linhas) e cadastros estáticos (NCM, unidades de medida, máquinas, operadores, categorias MP, etc.) que não estavam no script.

## Causa raiz
O bloco de China termina na linha 44; a partir da linha 46 o script encadeia DELETEs em tabelas do Fábrica Brasil, dentro da mesma transação `BEGIN; ... COMMIT;`. O escopo do PR/comando que originou a migration foi mal interpretado pelo agente: pediu-se apagar dados do módulo Fábrica China e o agente expandiu para a árvore Fábrica completa.

## Recuperação
Estratégia documentada em `.lovable/plan.md`:

1. PITR para timestamp `2026-05-16 01:20:00 UTC` em projeto/branch temporário (ação manual no painel Lovable Cloud).
2. Extração `pg_dump --data-only` das tabelas listadas acima — script em `scripts/recovery/fabrica-br-extract.sh`.
3. Import seletivo em produção com `SET session_replication_role = replica` — script em `scripts/recovery/fabrica-br-import.sh`.
4. Verificação por contagem antes/depois e smoke test nas telas `/dashboard/fabrica/produtos-acabados`, `/dashboard/fabrica/tabelas-preco`, `/dashboard/fabrica/matriz`, `/dashboard/fabrica/ficha-custos/<id>`.

A migration `20260516012327` permanece registrada em `supabase_migrations.schema_migrations` como aplicada — **não remover esse registro** sob risco de replay destrutivo.

## Prevenção
- CI guard: `.github/workflows/regression-greps.yml` falha se uma migration nova contiver `DELETE FROM fabrica_*` ou `TRUNCATE fabrica_*` sem o token de override `-- ALLOW-DESTRUCTIVE-FABRICA`.
- Política reforçada: qualquer migration com `DELETE`/`TRUNCATE` em tabelas de dados de domínio (não cadastro) exige escopo explícito por tabela + revisão humana.
