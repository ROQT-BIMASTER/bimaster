-- Drop and recreate vw_dashboard_kpis to fix column order
DROP VIEW IF EXISTS public.vw_dashboard_kpis;
CREATE VIEW public.vw_dashboard_kpis AS
SELECT
  EXTRACT(YEAR FROM data)::INTEGER AS ano,
  EXTRACT(MONTH FROM data)::INTEGER AS mes,
  id_empresa,
  supervisor,
  cod_vend,
  uf,
  marca,
  tabela AS tabela_preco,
  operacao,
  SUM(COALESCE(venda, preco_venda * quantidade, 0)) AS receita_total,
  COUNT(DISTINCT pedido) AS qtde_pedidos,
  COUNT(DISTINCT cod_cliente) AS clientes_ativos,
  SUM(quantidade) AS qtde_itens
FROM public.vendas_union
GROUP BY ano, mes, id_empresa, supervisor, cod_vend, uf, marca, tabela, operacao;

-- Fix vw_receita_empresa
DROP VIEW IF EXISTS public.vw_receita_empresa;
CREATE VIEW public.vw_receita_empresa AS
SELECT
  EXTRACT(YEAR FROM v.data)::INTEGER AS ano,
  EXTRACT(MONTH FROM v.data)::INTEGER AS mes,
  v.id_empresa,
  e.nome_empresa,
  v.operacao,
  SUM(COALESCE(v.venda, v.preco_venda * v.quantidade, 0)) AS receita_total,
  COUNT(DISTINCT v.pedido) AS qtde_pedidos
FROM public.vendas_union v
LEFT JOIN public.dim_empresa e ON e.id_empresa = v.id_empresa
GROUP BY ano, mes, v.id_empresa, e.nome_empresa, v.operacao;

-- Fix vw_ranking_supervisores
DROP VIEW IF EXISTS public.vw_ranking_supervisores;
CREATE VIEW public.vw_ranking_supervisores AS
SELECT
  EXTRACT(YEAR FROM data)::INTEGER AS ano,
  EXTRACT(MONTH FROM data)::INTEGER AS mes,
  id_empresa,
  supervisor,
  operacao,
  SUM(COALESCE(venda, preco_venda * quantidade, 0)) AS receita_total,
  COUNT(DISTINCT pedido) AS qtde_pedidos,
  COUNT(DISTINCT cod_cliente) AS clientes_ativos
FROM public.vendas_union
GROUP BY ano, mes, id_empresa, supervisor, operacao;

-- Fix vw_ranking_vendedores
DROP VIEW IF EXISTS public.vw_ranking_vendedores;
CREATE VIEW public.vw_ranking_vendedores AS
SELECT
  EXTRACT(YEAR FROM data)::INTEGER AS ano,
  EXTRACT(MONTH FROM data)::INTEGER AS mes,
  id_empresa,
  supervisor,
  cod_vend,
  vendedor,
  operacao,
  SUM(COALESCE(venda, preco_venda * quantidade, 0)) AS receita_total,
  COUNT(DISTINCT pedido) AS qtde_pedidos,
  COUNT(DISTINCT cod_cliente) AS clientes_ativos
FROM public.vendas_union
GROUP BY ano, mes, id_empresa, supervisor, cod_vend, vendedor, operacao;

-- Metas table
CREATE TABLE IF NOT EXISTS public.metas_vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo TEXT NOT NULL,
  tipo_meta TEXT NOT NULL CHECK (tipo_meta IN ('empresa', 'supervisor', 'vendedor')),
  referencia_id TEXT NOT NULL,
  valor_meta NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(periodo, tipo_meta, referencia_id)
);

ALTER TABLE public.metas_vendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on metas_vendas" ON public.metas_vendas
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated read metas_vendas" ON public.metas_vendas
  FOR SELECT TO authenticated USING (true);