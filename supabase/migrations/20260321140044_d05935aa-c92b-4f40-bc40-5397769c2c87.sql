-- Add tabela column to vw_dashboard_kpis so tabela filter works
DROP VIEW IF EXISTS public.vw_dashboard_kpis;

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
  tabela,
  SUM(COALESCE(venda, preco_venda * quantidade, 0)) AS receita_total,
  COUNT(DISTINCT pedido) AS qtde_pedidos,
  SUM(COALESCE(venda, preco_venda * quantidade, 0)) / NULLIF(COUNT(DISTINCT pedido), 0) AS ticket_medio,
  COUNT(DISTINCT cod_cliente) AS clientes_ativos,
  SUM(quantidade) AS qtde_itens
FROM public."Union"
GROUP BY ano, mes, id_empresa, supervisor, cod_vend, uf, marca, operacao, tabela;