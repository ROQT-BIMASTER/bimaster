
-- FIX 4: Recreate all remaining SECURITY DEFINER views with SECURITY INVOKER

-- 1. vendas_union (has INSTEAD OF INSERT trigger/rule - need to check)
DROP VIEW IF EXISTS public.vendas_union CASCADE;
CREATE VIEW public.vendas_union
WITH (security_invoker = on) AS
SELECT id, id_empresa, empresa, pedido, data, nota, operacao, cod_cliente, cliente,
       id_ramo, ramo, cidade, uf, tp_venda, tp_nfe, cod_produto, descricao, marca,
       quantidade, preco_venda, vl_desconto, vl_icm_subst, vl_cmv, vl_outros_custos,
       tabela, cod_vend, vendedor, cod_equipe, nome_equipe, supervisor, nome_linha,
       created_at, updated_at, venda
FROM "Union";

-- Recreate the INSTEAD OF INSERT rule for vendas_union
CREATE RULE vendas_union_insert AS ON INSERT TO public.vendas_union
DO INSTEAD INSERT INTO public."Union" (
  id_empresa, empresa, pedido, data, nota, operacao, cod_cliente, cliente,
  id_ramo, ramo, cidade, uf, tp_venda, tp_nfe, cod_produto, descricao, marca,
  quantidade, preco_venda, vl_desconto, vl_icm_subst, vl_cmv, vl_outros_custos,
  tabela, cod_vend, vendedor, cod_equipe, nome_equipe, supervisor, nome_linha, venda
) VALUES (
  NEW.id_empresa, NEW.empresa, NEW.pedido, NEW.data, NEW.nota, NEW.operacao,
  NEW.cod_cliente, NEW.cliente, NEW.id_ramo, NEW.ramo, NEW.cidade, NEW.uf,
  NEW.tp_venda, NEW.tp_nfe, NEW.cod_produto, NEW.descricao, NEW.marca,
  NEW.quantidade, NEW.preco_venda, NEW.vl_desconto, NEW.vl_icm_subst,
  NEW.vl_cmv, NEW.vl_outros_custos, NEW.tabela, NEW.cod_vend, NEW.vendedor,
  NEW.cod_equipe, NEW.nome_equipe, NEW.supervisor, NEW.nome_linha, NEW.venda
);

-- 2. vw_ranking_vendedores
DROP VIEW IF EXISTS public.vw_ranking_vendedores;
CREATE VIEW public.vw_ranking_vendedores
WITH (security_invoker = on) AS
SELECT (EXTRACT(year FROM data))::integer AS ano,
    (EXTRACT(month FROM data))::integer AS mes,
    id_empresa, cod_vend, vendedor, supervisor, operacao,
    sum(COALESCE(venda, (preco_venda * quantidade), 0::numeric)) AS receita_total,
    count(DISTINCT pedido) AS qtde_pedidos,
    count(DISTINCT cod_cliente) AS clientes_ativos
FROM "Union"
GROUP BY (EXTRACT(year FROM data))::integer, (EXTRACT(month FROM data))::integer,
         id_empresa, cod_vend, vendedor, supervisor, operacao;

-- 3. vw_ranking_supervisores
DROP VIEW IF EXISTS public.vw_ranking_supervisores;
CREATE VIEW public.vw_ranking_supervisores
WITH (security_invoker = on) AS
SELECT (EXTRACT(year FROM data))::integer AS ano,
    (EXTRACT(month FROM data))::integer AS mes,
    id_empresa, supervisor, operacao,
    sum(COALESCE(venda, (preco_venda * quantidade), 0::numeric)) AS receita_total,
    count(DISTINCT pedido) AS qtde_pedidos,
    count(DISTINCT cod_cliente) AS clientes_ativos
FROM "Union"
GROUP BY (EXTRACT(year FROM data))::integer, (EXTRACT(month FROM data))::integer,
         id_empresa, supervisor, operacao;

-- 4. vw_receita_empresa
DROP VIEW IF EXISTS public.vw_receita_empresa;
CREATE VIEW public.vw_receita_empresa
WITH (security_invoker = on) AS
SELECT (EXTRACT(year FROM data))::integer AS ano,
    (EXTRACT(month FROM data))::integer AS mes,
    id_empresa, empresa, operacao,
    sum(COALESCE(venda, (preco_venda * quantidade), 0::numeric)) AS receita_total,
    count(DISTINCT pedido) AS qtde_pedidos,
    count(DISTINCT cod_cliente) AS clientes_ativos
FROM "Union"
GROUP BY (EXTRACT(year FROM data))::integer, (EXTRACT(month FROM data))::integer,
         id_empresa, empresa, operacao;

-- 5. vw_dashboard_kpis
DROP VIEW IF EXISTS public.vw_dashboard_kpis;
CREATE VIEW public.vw_dashboard_kpis
WITH (security_invoker = on) AS
SELECT (EXTRACT(year FROM data))::integer AS ano,
    (EXTRACT(month FROM data))::integer AS mes,
    id_empresa, supervisor, cod_vend, uf, marca, operacao, tabela,
    sum(COALESCE(venda, (preco_venda * quantidade), 0::numeric)) AS receita_total,
    count(DISTINCT pedido) AS qtde_pedidos,
    (sum(COALESCE(venda, (preco_venda * quantidade), 0::numeric)) / NULLIF(count(DISTINCT pedido), 0)::numeric) AS ticket_medio,
    count(DISTINCT cod_cliente) AS clientes_ativos,
    sum(quantidade) AS qtde_itens
FROM "Union"
GROUP BY (EXTRACT(year FROM data))::integer, (EXTRACT(month FROM data))::integer,
         id_empresa, supervisor, cod_vend, uf, marca, operacao, tabela;

-- 6. vw_contas_receber_completo
DROP VIEW IF EXISTS public.vw_contas_receber_completo;
CREATE VIEW public.vw_contas_receber_completo
WITH (security_invoker = on) AS
SELECT cr.id, cr.empresa_id, cr.numero_documento, cr.descricao,
    f.id AS cliente_id, f.razao_social AS cliente_nome, f.cnpj AS cliente_documento,
    cr.data_emissao, cr.data_vencimento, cr.data_competencia,
    cr.valor_original, cr.valor_desconto, cr.valor_juros, cr.valor_liquido, cr.valor_recebido,
    (cr.valor_liquido - cr.valor_recebido) AS valor_saldo,
    cr.status,
    CASE WHEN cr.status = ANY (ARRAY['pendente','parcial']) AND cr.data_vencimento < CURRENT_DATE THEN true ELSE false END AS esta_vencido,
    cr.num_parcelas,
    (SELECT count(*) FROM parcelas_receber p WHERE p.conta_receber_id = cr.id AND p.status::text = 'recebido') AS parcelas_recebidas,
    (SELECT count(*) FROM parcelas_receber p WHERE p.conta_receber_id = cr.id AND p.status::text = 'pendente') AS parcelas_pendentes,
    cr.codigo_integracao, cr.enviado_erp, cr.bloqueado, cr.inativo,
    cr.data_inc, cr.hora_inc, cr.user_inc, cr.data_alt, cr.hora_alt, cr.user_alt,
    cr.created_at, cr.updated_at
FROM contas_receber cr
LEFT JOIN fornecedores f ON f.id = cr.cliente_id;

-- 7. vw_extrato_conta_corrente
DROP VIEW IF EXISTS public.vw_extrato_conta_corrente;
CREATE VIEW public.vw_extrato_conta_corrente
WITH (security_invoker = on) AS
SELECT cb.id AS conta_bancaria_id, cb.banco AS conta_nome,
    'debito'::text AS tipo_movimento, pag.data_pagamento AS data_movimento,
    (pag.valor * -1::numeric) AS valor, cp.fornecedor_nome AS descricao,
    cp.numero_documento, 'pagamento'::text AS origem, pag.id AS referencia_id
FROM pagamentos pag
JOIN parcelas par ON par.id = pag.parcela_id
JOIN contas_pagar cp ON cp.id = par.conta_pagar_id
JOIN contas_bancarias cb ON cb.id = pag.conta_bancaria_id
WHERE pag.conta_bancaria_id IS NOT NULL
UNION ALL
SELECT cb.id AS conta_bancaria_id, cb.banco AS conta_nome,
    'credito'::text AS tipo_movimento, rec.data_recebimento AS data_movimento,
    rec.valor_recebido AS valor, cr.descricao,
    cr.numero_documento, 'recebimento'::text AS origem, rec.id AS referencia_id
FROM recebimentos rec
JOIN parcelas_receber par ON par.id = rec.parcela_receber_id
JOIN contas_receber cr ON cr.id = par.conta_receber_id
JOIN contas_bancarias cb ON cb.id = rec.conta_bancaria_id
WHERE rec.status::text = 'confirmado'
UNION ALL
SELECT lcc.conta_bancaria_id, cb.banco AS conta_nome,
    lcc.tipo AS tipo_movimento, lcc.data_lancamento AS data_movimento,
    CASE WHEN lcc.tipo::text = 'debito' THEN (lcc.valor * -1::numeric) ELSE lcc.valor END AS valor,
    lcc.descricao, lcc.numero_documento, lcc.origem, lcc.id AS referencia_id
FROM lancamentos_conta_corrente lcc
JOIN contas_bancarias cb ON cb.id = lcc.conta_bancaria_id
WHERE lcc.inativo = false;

-- 8. vw_process_timeline
DROP VIEW IF EXISTS public.vw_process_timeline;
CREATE VIEW public.vw_process_timeline
WITH (security_invoker = on) AS
SELECT h.id, 'fabrica'::text AS modulo_origem, h.produto_id AS entity_id,
    h.acao AS tipo_evento,
    COALESCE(CASE WHEN h.acao::text = 'INSERT' THEN 'Produto cadastrado na fábrica'::varchar
                  WHEN h.acao::text = 'UPDATE' THEN 'Produto atualizado na fábrica'::varchar
                  ELSE h.acao END) AS descricao,
    h.usuario_id, NULL::text AS usuario_nome,
    COALESCE(h.campos_alterados, '{}'::jsonb) AS metadata, h.created_at
FROM fabrica_produtos_historico h
UNION ALL
SELECT h.id, 'brasil'::text AS modulo_origem, h.produto_brasil_id AS entity_id,
    h.tipo AS tipo_evento, COALESCE(h.descricao, h.tipo) AS descricao,
    h.user_id AS usuario_id, NULL::text AS usuario_nome,
    COALESCE(h.metadata, '{}'::jsonb) AS metadata, h.created_at
FROM produto_brasil_historico h
UNION ALL
SELECT h.id, 'documentos'::text AS modulo_origem, COALESCE(h.produto_id, h.projeto_id) AS entity_id,
    h.acao AS tipo_evento, h.acao AS descricao,
    h.user_id AS usuario_id, h.user_name AS usuario_nome,
    COALESCE(h.detalhes, '{}'::jsonb) AS metadata, h.created_at
FROM produto_doc_audit_log h
UNION ALL
SELECT t.id, 'aprovacao'::text AS modulo_origem, t.instancia_id AS entity_id,
    t.acao AS tipo_evento,
    (COALESCE(t.etapa_nome, '') || ' - ' || t.acao) AS descricao,
    t.usuario_id, NULL::text AS usuario_nome,
    jsonb_build_object('etapa_nome', t.etapa_nome, 'observacao', t.observacao, 'rodada', t.rodada) AS metadata,
    t.created_at
FROM fluxo_aprovacao_transicoes t;
