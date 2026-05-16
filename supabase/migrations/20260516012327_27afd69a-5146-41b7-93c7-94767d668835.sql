BEGIN;

-- =========================================================
-- VINCULAR CHINA
-- =========================================================
DELETE FROM china_oc_custos;
DELETE FROM china_oc_saldo_decisoes;
DELETE FROM china_oc_versoes;
DELETE FROM china_ordem_itens;
DELETE FROM china_producao_apontamentos;
DELETE FROM china_recebimento_itens;
DELETE FROM china_recebimento_alertas;
DELETE FROM china_recebimentos_carga;
DELETE FROM china_embarque_itens;
DELETE FROM china_embarque_documentos;
DELETE FROM china_embarques;
DELETE FROM china_nao_conformidades;
DELETE FROM china_ordens_compra;
DELETE FROM china_doc_alertas;
DELETE FROM china_doc_revisoes;
DELETE FROM china_doc_versoes;
DELETE FROM china_documento_tarefa_vinculos;
DELETE FROM china_produto_documentos;
DELETE FROM china_checklist_item_estado;
DELETE FROM china_checklist_itens_ocultos;
DELETE FROM china_checklist_custom_itens;
DELETE FROM china_checklist_custom_categorias;
DELETE FROM china_checklist_cat_overrides;
DELETE FROM china_produto_checklist_celulas;
DELETE FROM china_produto_checklist;
DELETE FROM china_produto_cores;
DELETE FROM china_ficha_despachos;
DELETE FROM china_ficha_visibilidade;
DELETE FROM china_pasta_digital;
DELETE FROM china_chat_mensagens;
DELETE FROM china_timeline_eventos;
DELETE FROM china_timeline_sla;
DELETE FROM china_submissao_tarefa_vinculos;
DELETE FROM china_submissao_projetos;
DELETE FROM china_submissao_user_flags;
DELETE FROM china_inbox_snooze;
DELETE FROM china_inbox_read_state;
DELETE FROM china_copilot_relatorios;
DELETE FROM china_produto_submissoes;

-- =========================================================
-- FÁBRICA — ordem segura (filhos antes de pais)
-- =========================================================
-- 1) Preços / aprovações
DELETE FROM fabrica_alertas_precos;
DELETE FROM fabrica_tarefas_ajuste_preco;
DELETE FROM fabrica_historico_precos;
DELETE FROM fabrica_markup_overrides;
DELETE FROM fabrica_limites_preco_tabela;
DELETE FROM fabrica_precos_produtos;
DELETE FROM fabrica_tabelas_preco_versoes;
DELETE FROM fabrica_tabelas_preco;

-- 2) Revisões de ficha (FK auto-ref: documentos → mensagens)
UPDATE fabrica_revisao_documentos SET mensagem_id = NULL WHERE mensagem_id IS NOT NULL;
DELETE FROM fabrica_revisao_documentos;
DELETE FROM fabrica_revisao_mensagens;
DELETE FROM fabrica_revisao_requisitos;
DELETE FROM fabrica_ficha_custo_revisao_itens;
DELETE FROM fabrica_ficha_custo_revisoes;
DELETE FROM fabrica_custo_evidencias;
DELETE FROM fabrica_custos_producao;
DELETE FROM fabrica_custos_origem;
DELETE FROM fabrica_insumo_custo_historico;
DELETE FROM fabrica_acoes_corretivas;
DELETE FROM fabrica_produto_custos;

-- 3) Movimentações, apontamentos, paradas (antes de produtos/MP/máquinas)
DELETE FROM fabrica_movimentacoes_estoque;
DELETE FROM fabrica_movimentacoes;
DELETE FROM fabrica_paradas;
DELETE FROM fabrica_apontamentos;
DELETE FROM fabrica_retrabalhos;
DELETE FROM fabrica_refugos;
DELETE FROM fabrica_inspecoes_qualidade;
DELETE FROM fabrica_nao_conformidades;
DELETE FROM fabrica_planejamento_necessidades;
DELETE FROM fabrica_roteiros_producao;
DELETE FROM fabrica_ordens_producao;
DELETE FROM fabrica_lotes;
DELETE FROM fabrica_timesheets;
DELETE FROM fabrica_processamento_logs;

-- 4) Fiscal vinculado a produtos
DELETE FROM fabrica_apuracao_fiscal;
DELETE FROM fabrica_creditos_tributarios;
DELETE FROM fabrica_validacoes_fiscais;
DELETE FROM fabrica_dados_fiscais_produto;

-- 5) NF / Compras / Recebimentos (referenciam produtos e MP)
DELETE FROM fabrica_compra_recebimento_itens;
DELETE FROM fabrica_compra_recebimentos;
DELETE FROM fabrica_compra_itens;
DELETE FROM fabrica_compras;
DELETE FROM fabrica_itens_nf;
DELETE FROM fabrica_itens_nf_saida;
DELETE FROM fabrica_notas_fiscais;
DELETE FROM fabrica_notas_fiscais_saida;
DELETE FROM fabrica_nfe_xmls;

-- 6) Fórmulas (referenciam MP)
DELETE FROM fabrica_formula_itens;
DELETE FROM fabrica_formula_versoes;
DELETE FROM fabrica_formulas;

-- 7) MP cotações + MP
DELETE FROM fabrica_mp_cotacoes;
DELETE FROM fabrica_materias_primas;

-- 8) Produtos (último)
DELETE FROM fabrica_produto_grade_itens;
DELETE FROM fabrica_produto_visibility_blocks;
DELETE FROM fabrica_produtos_historico;
DELETE FROM fabrica_produtos;

COMMIT;