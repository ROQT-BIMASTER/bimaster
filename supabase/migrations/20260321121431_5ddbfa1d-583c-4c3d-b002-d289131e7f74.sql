
-- View 1: Dashboard KPIs agregados
CREATE OR REPLACE VIEW public.vw_dashboard_kpis AS
SELECT
  EXTRACT(YEAR FROM data)::INTEGER AS ano,
  EXTRACT(MONTH FROM data)::INTEGER AS mes,
  id_empresa,
  supervisor,
  cod_vend,
  uf,
  marca,
  SUM(preco_venda * quantidade) AS receita_total,
  COUNT(DISTINCT pedido) AS qtde_pedidos,
  SUM(preco_venda * quantidade) / NULLIF(COUNT(DISTINCT pedido), 0) AS ticket_medio,
  COUNT(DISTINCT cod_cliente) AS clientes_ativos,
  SUM(quantidade) AS qtde_itens
FROM public.vendas_union
WHERE data IS NOT NULL
GROUP BY ano, mes, id_empresa, supervisor, cod_vend, uf, marca;

-- View 2: Receita por empresa/mês
CREATE OR REPLACE VIEW public.vw_receita_empresa AS
SELECT
  EXTRACT(YEAR FROM data)::INTEGER AS ano,
  EXTRACT(MONTH FROM data)::INTEGER AS mes,
  v.id_empresa,
  e.nome_empresa,
  SUM(v.preco_venda * v.quantidade) AS receita_total,
  COUNT(DISTINCT v.pedido) AS qtde_pedidos
FROM public.vendas_union v
LEFT JOIN public.dim_empresa e ON e.id_empresa = v.id_empresa
WHERE v.data IS NOT NULL
GROUP BY ano, mes, v.id_empresa, e.nome_empresa;

-- View 3: Ranking supervisores
CREATE OR REPLACE VIEW public.vw_ranking_supervisores AS
SELECT
  EXTRACT(YEAR FROM data)::INTEGER AS ano,
  EXTRACT(MONTH FROM data)::INTEGER AS mes,
  supervisor,
  id_empresa,
  SUM(preco_venda * quantidade) AS receita_total,
  COUNT(DISTINCT pedido) AS qtde_pedidos,
  COUNT(DISTINCT cod_cliente) AS clientes_ativos
FROM public.vendas_union
WHERE data IS NOT NULL AND supervisor IS NOT NULL AND supervisor != ''
GROUP BY ano, mes, supervisor, id_empresa;

-- View 4: Ranking vendedores
CREATE OR REPLACE VIEW public.vw_ranking_vendedores AS
SELECT
  EXTRACT(YEAR FROM data)::INTEGER AS ano,
  EXTRACT(MONTH FROM data)::INTEGER AS mes,
  v.cod_vend,
  v.vendedor,
  v.supervisor,
  v.id_empresa,
  SUM(v.preco_venda * v.quantidade) AS receita_total,
  COUNT(DISTINCT v.pedido) AS qtde_pedidos,
  COUNT(DISTINCT v.cod_cliente) AS clientes_ativos
FROM public.vendas_union v
WHERE v.data IS NOT NULL AND v.cod_vend IS NOT NULL
GROUP BY ano, mes, v.cod_vend, v.vendedor, v.supervisor, v.id_empresa;
