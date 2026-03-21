
-- Step 1: Drop dependent views first
DROP VIEW IF EXISTS public.vw_dashboard_kpis;
DROP VIEW IF EXISTS public.vw_receita_empresa;
DROP VIEW IF EXISTS public.vw_ranking_supervisores;
DROP VIEW IF EXISTS public.vw_ranking_vendedores;

-- Step 2: Rename table
ALTER TABLE public.vendas_union RENAME TO "Union";

-- Step 3: Create compatibility view so all existing code keeps working
CREATE VIEW public.vendas_union WITH (security_invoker = true) AS
SELECT * FROM public."Union";

-- Step 4: Allow inserts through the view (for edge function)
CREATE OR REPLACE RULE vendas_union_insert AS
ON INSERT TO public.vendas_union
DO INSTEAD
INSERT INTO public."Union" VALUES (NEW.*);

-- Step 5: Recreate analytical views pointing to "Union"
CREATE VIEW public.vw_dashboard_kpis AS
SELECT
  EXTRACT(YEAR FROM data)::int AS ano,
  EXTRACT(MONTH FROM data)::int AS mes,
  id_empresa,
  supervisor,
  cod_vend,
  uf,
  marca,
  operacao,
  SUM(COALESCE(venda, preco_venda * quantidade, 0)) AS receita_total,
  COUNT(DISTINCT pedido) AS qtde_pedidos,
  SUM(COALESCE(venda, preco_venda * quantidade, 0)) / NULLIF(COUNT(DISTINCT pedido), 0) AS ticket_medio,
  COUNT(DISTINCT cod_cliente) AS clientes_ativos,
  SUM(quantidade) AS qtde_itens
FROM public."Union"
GROUP BY ano, mes, id_empresa, supervisor, cod_vend, uf, marca, operacao;

CREATE VIEW public.vw_receita_empresa AS
SELECT
  EXTRACT(YEAR FROM data)::int AS ano,
  EXTRACT(MONTH FROM data)::int AS mes,
  id_empresa,
  empresa,
  operacao,
  SUM(COALESCE(venda, preco_venda * quantidade, 0)) AS receita_total,
  COUNT(DISTINCT pedido) AS qtde_pedidos,
  COUNT(DISTINCT cod_cliente) AS clientes_ativos
FROM public."Union"
GROUP BY ano, mes, id_empresa, empresa, operacao;

CREATE VIEW public.vw_ranking_supervisores AS
SELECT
  EXTRACT(YEAR FROM data)::int AS ano,
  EXTRACT(MONTH FROM data)::int AS mes,
  id_empresa,
  supervisor,
  operacao,
  SUM(COALESCE(venda, preco_venda * quantidade, 0)) AS receita_total,
  COUNT(DISTINCT pedido) AS qtde_pedidos,
  COUNT(DISTINCT cod_cliente) AS clientes_ativos
FROM public."Union"
GROUP BY ano, mes, id_empresa, supervisor, operacao;

CREATE VIEW public.vw_ranking_vendedores AS
SELECT
  EXTRACT(YEAR FROM data)::int AS ano,
  EXTRACT(MONTH FROM data)::int AS mes,
  id_empresa,
  cod_vend,
  vendedor,
  supervisor,
  operacao,
  SUM(COALESCE(venda, preco_venda * quantidade, 0)) AS receita_total,
  COUNT(DISTINCT pedido) AS qtde_pedidos,
  COUNT(DISTINCT cod_cliente) AS clientes_ativos
FROM public."Union"
GROUP BY ano, mes, id_empresa, cod_vend, vendedor, supervisor, operacao;
