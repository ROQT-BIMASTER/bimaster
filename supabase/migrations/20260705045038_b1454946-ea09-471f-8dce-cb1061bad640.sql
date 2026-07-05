CREATE OR REPLACE VIEW public.v_vendas_item_rubysp WITH (security_invoker = true) AS
SELECT i.rubysp_pedido_id, i.produto_id, i.descricao, i.quantidade, i.total_item,
  COALESCE(p.ts_faturamento, p.data_pedido)::date AS data_venda, p.empresa_id
FROM public.erp_pedido_itens_rubysp i
JOIN public.erp_pedidos_rubysp p ON p.rubysp_pedido_id = i.rubysp_pedido_id
WHERE p.etapa IN ('faturado','entregue') AND p.bonificacao = false;

GRANT SELECT ON public.v_vendas_item_rubysp TO authenticated;

CREATE OR REPLACE FUNCTION public.vendas_produto_resumo_rubysp(p_desde date DEFAULT '2025-01-01', p_empresa int DEFAULT NULL)
RETURNS TABLE(produto_id bigint, descricao text, qtd_total numeric, valor_total numeric,
  meses_ativos int, media_mensal numeric, desvio_mensal numeric, cv numeric, classe_abc text, classe_xyz text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
  WITH meses AS (
    SELECT generate_series(date_trunc('month',p_desde), date_trunc('month',current_date), interval '1 month')::date AS mes
  ),
  prod AS (
    SELECT produto_id, max(descricao) AS descricao FROM v_vendas_item_rubysp
    WHERE data_venda >= p_desde AND (p_empresa IS NULL OR empresa_id=p_empresa) GROUP BY produto_id
  ),
  mensal AS (
    SELECT pr.produto_id, m.mes, COALESCE(SUM(vi.quantidade),0) AS qtd, COALESCE(SUM(vi.total_item),0) AS valor
    FROM prod pr CROSS JOIN meses m
    LEFT JOIN v_vendas_item_rubysp vi ON vi.produto_id=pr.produto_id AND date_trunc('month',vi.data_venda)=m.mes
      AND (p_empresa IS NULL OR vi.empresa_id=p_empresa)
    GROUP BY pr.produto_id, m.mes
  ),
  agg AS (
    SELECT produto_id, SUM(qtd) qtd_total, SUM(valor) valor_total,
      COUNT(*) FILTER (WHERE qtd>0)::int meses_ativos, AVG(qtd) media_mensal, STDDEV_POP(qtd) desvio_mensal,
      CASE WHEN AVG(qtd)>0 THEN STDDEV_POP(qtd)/AVG(qtd) END cv FROM mensal GROUP BY produto_id
  ),
  abc AS (
    SELECT produto_id, SUM(valor_total) OVER (ORDER BY valor_total DESC)/NULLIF(SUM(valor_total) OVER (),0) AS cum FROM agg
  )
  SELECT a.produto_id, pr.descricao, a.qtd_total, a.valor_total, a.meses_ativos, a.media_mensal, a.desvio_mensal, a.cv,
    CASE WHEN b.cum<=0.8 THEN 'A' WHEN b.cum<=0.95 THEN 'B' ELSE 'C' END,
    CASE WHEN a.cv IS NULL THEN 'Z' WHEN a.cv<=0.5 THEN 'X' WHEN a.cv<=1 THEN 'Y' ELSE 'Z' END
  FROM agg a JOIN abc b USING(produto_id) JOIN prod pr USING(produto_id) ORDER BY a.valor_total DESC;
$$;

GRANT EXECUTE ON FUNCTION public.vendas_produto_resumo_rubysp(date,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.vendas_serie_mensal_produto_rubysp(p_produto_id bigint, p_desde date DEFAULT '2025-01-01')
RETURNS TABLE(mes date, quantidade numeric, valor numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
  SELECT date_trunc('month',data_venda)::date, COALESCE(SUM(quantidade),0), COALESCE(SUM(total_item),0)
  FROM v_vendas_item_rubysp WHERE produto_id=p_produto_id AND data_venda>=p_desde GROUP BY 1 ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.vendas_serie_mensal_produto_rubysp(bigint,date) TO authenticated;