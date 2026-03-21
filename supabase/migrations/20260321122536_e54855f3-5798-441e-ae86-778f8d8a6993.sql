
-- Drop existing views to add new columns
DROP VIEW IF EXISTS public.vw_dashboard_kpis CASCADE;
DROP VIEW IF EXISTS public.vw_receita_empresa CASCADE;
DROP VIEW IF EXISTS public.vw_ranking_supervisores CASCADE;
DROP VIEW IF EXISTS public.vw_ranking_vendedores CASCADE;

-- Recreate with vl_outros_custos and operacao/tabela columns
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
  SUM(vl_outros_custos) AS receita_total,
  COUNT(DISTINCT pedido) AS qtde_pedidos,
  SUM(vl_outros_custos) / NULLIF(COUNT(DISTINCT pedido), 0) AS ticket_medio,
  COUNT(DISTINCT cod_cliente) AS clientes_ativos,
  SUM(quantidade) AS qtde_itens
FROM public.vendas_union
WHERE data IS NOT NULL
GROUP BY ano, mes, id_empresa, supervisor, cod_vend, uf, marca, tabela, operacao;

CREATE VIEW public.vw_receita_empresa AS
SELECT
  EXTRACT(YEAR FROM data)::INTEGER AS ano,
  EXTRACT(MONTH FROM data)::INTEGER AS mes,
  v.id_empresa,
  e.nome_empresa,
  v.operacao,
  SUM(v.vl_outros_custos) AS receita_total,
  COUNT(DISTINCT v.pedido) AS qtde_pedidos
FROM public.vendas_union v
LEFT JOIN public.dim_empresa e ON e.id_empresa = v.id_empresa
WHERE v.data IS NOT NULL
GROUP BY ano, mes, v.id_empresa, e.nome_empresa, v.operacao;

CREATE VIEW public.vw_ranking_supervisores AS
SELECT
  EXTRACT(YEAR FROM data)::INTEGER AS ano,
  EXTRACT(MONTH FROM data)::INTEGER AS mes,
  supervisor,
  id_empresa,
  operacao,
  SUM(vl_outros_custos) AS receita_total,
  COUNT(DISTINCT pedido) AS qtde_pedidos,
  COUNT(DISTINCT cod_cliente) AS clientes_ativos
FROM public.vendas_union
WHERE data IS NOT NULL AND supervisor IS NOT NULL AND supervisor != ''
GROUP BY ano, mes, supervisor, id_empresa, operacao;

CREATE VIEW public.vw_ranking_vendedores AS
SELECT
  EXTRACT(YEAR FROM data)::INTEGER AS ano,
  EXTRACT(MONTH FROM data)::INTEGER AS mes,
  v.cod_vend,
  v.vendedor,
  v.supervisor,
  v.id_empresa,
  v.operacao,
  SUM(v.vl_outros_custos) AS receita_total,
  COUNT(DISTINCT v.pedido) AS qtde_pedidos,
  COUNT(DISTINCT v.cod_cliente) AS clientes_ativos
FROM public.vendas_union v
WHERE v.data IS NOT NULL AND v.cod_vend IS NOT NULL
GROUP BY ano, mes, v.cod_vend, v.vendedor, v.supervisor, v.id_empresa, v.operacao;

-- Config operacoes table
CREATE TABLE IF NOT EXISTS public.config_operacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operacao TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL DEFAULT 'positivo',
  visivel BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.config_operacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_config_operacoes" ON public.config_operacoes
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "admin_manage_config_operacoes" ON public.config_operacoes
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Config tabelas usuario table
CREATE TABLE IF NOT EXISTS public.config_tabelas_usuario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tabela_preco TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tabela_preco)
);

ALTER TABLE public.config_tabelas_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_read_own_tabelas" ON public.config_tabelas_usuario
FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_manage_tabelas_usuario" ON public.config_tabelas_usuario
FOR ALL USING (public.has_role(auth.uid(), 'admin'));
