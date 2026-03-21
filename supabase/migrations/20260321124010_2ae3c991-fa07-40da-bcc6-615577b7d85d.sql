
-- Add venda column to vendas_union
ALTER TABLE public.vendas_union ADD COLUMN IF NOT EXISTS venda NUMERIC;

-- Must DROP first because column set changed
DROP VIEW IF EXISTS public.vw_dashboard_kpis;
DROP VIEW IF EXISTS public.vw_receita_empresa;
DROP VIEW IF EXISTS public.vw_ranking_supervisores;
DROP VIEW IF EXISTS public.vw_ranking_vendedores;

CREATE VIEW public.vw_dashboard_kpis AS
SELECT
  EXTRACT(YEAR FROM data)::INTEGER AS ano,
  EXTRACT(MONTH FROM data)::INTEGER AS mes,
  id_empresa, supervisor, cod_vend, uf, marca,
  tabela AS tabela_preco, operacao,
  SUM(COALESCE(venda, preco_venda * quantidade, vl_outros_custos)) AS receita_total,
  COUNT(DISTINCT pedido) AS qtde_pedidos,
  SUM(quantidade) AS qtde_itens,
  COUNT(DISTINCT cod_cliente) AS clientes_ativos
FROM public.vendas_union
GROUP BY ano, mes, id_empresa, supervisor, cod_vend, uf, marca, tabela, operacao;

CREATE VIEW public.vw_receita_empresa AS
SELECT
  EXTRACT(YEAR FROM data)::INTEGER AS ano,
  EXTRACT(MONTH FROM data)::INTEGER AS mes,
  v.id_empresa,
  COALESCE(e.nome_empresa, 'Empresa ' || v.id_empresa) AS nome_empresa,
  operacao,
  SUM(COALESCE(venda, preco_venda * quantidade, vl_outros_custos)) AS receita_total,
  COUNT(DISTINCT pedido) AS qtde_pedidos
FROM public.vendas_union v
LEFT JOIN public.dim_empresa e ON e.id_empresa = v.id_empresa
GROUP BY ano, mes, v.id_empresa, e.nome_empresa, operacao;

CREATE VIEW public.vw_ranking_supervisores AS
SELECT
  EXTRACT(YEAR FROM data)::INTEGER AS ano,
  EXTRACT(MONTH FROM data)::INTEGER AS mes,
  id_empresa, supervisor, operacao,
  SUM(COALESCE(venda, preco_venda * quantidade, vl_outros_custos)) AS receita_total,
  COUNT(DISTINCT pedido) AS qtde_pedidos,
  COUNT(DISTINCT cod_cliente) AS clientes_ativos
FROM public.vendas_union
WHERE supervisor IS NOT NULL
GROUP BY ano, mes, id_empresa, supervisor, operacao;

CREATE VIEW public.vw_ranking_vendedores AS
SELECT
  EXTRACT(YEAR FROM data)::INTEGER AS ano,
  EXTRACT(MONTH FROM data)::INTEGER AS mes,
  id_empresa, cod_vend, vendedor, supervisor, operacao,
  SUM(COALESCE(venda, preco_venda * quantidade, vl_outros_custos)) AS receita_total,
  COUNT(DISTINCT pedido) AS qtde_pedidos,
  COUNT(DISTINCT cod_cliente) AS clientes_ativos
FROM public.vendas_union
WHERE cod_vend IS NOT NULL
GROUP BY ano, mes, id_empresa, cod_vend, vendedor, supervisor, operacao;
