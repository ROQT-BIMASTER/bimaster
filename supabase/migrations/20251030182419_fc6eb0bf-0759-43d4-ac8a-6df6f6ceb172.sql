-- ============================================
-- CORREÇÃO DOS WARNINGS DE SEGURANÇA
-- ============================================

-- 1. CORRIGIR FUNÇÕES SEM SEARCH_PATH
-- Todas as referências devem ser qualificadas com schema

-- 1.1 Função sincronizar_permissoes_usuario
CREATE OR REPLACE FUNCTION public.sincronizar_permissoes_usuario(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role public.app_role;
BEGIN
  -- Buscar role do usuário
  SELECT role INTO v_role
  FROM public.user_roles
  WHERE user_id = p_user_id
  LIMIT 1;

  -- Se for admin, não precisa de permissões individuais
  IF v_role = 'admin' THEN
    RETURN;
  END IF;

  -- Deletar permissões antigas do usuário
  DELETE FROM public.usuario_permissoes_telas
  WHERE usuario_id = p_user_id;

  -- Inserir permissões baseadas no role
  INSERT INTO public.usuario_permissoes_telas (usuario_id, tela_id)
  SELECT p_user_id, tela_id
  FROM public.role_permissoes_telas
  WHERE role = v_role;
END;
$$;

-- 1.2 Função refresh_daily_kpis
CREATE OR REPLACE FUNCTION public.refresh_daily_kpis(target_date date DEFAULT (CURRENT_DATE - 1))
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.agg_daily_kpis WHERE date = target_date;
  
  INSERT INTO public.agg_daily_kpis (
    date, regiao, uf, 
    total_visitas, total_vendas, total_investimentos, 
    media_ticket, total_prospects, prospects_convertidos,
    taxa_conversao, total_atividades
  )
  SELECT 
    target_date,
    COALESCE(m.regiao::text, ''),
    COALESCE(m.uf, ''),
    COUNT(DISTINCT v.id) AS total_visitas,
    COALESCE(SUM(s.net_value), 0) AS total_vendas,
    COALESCE(SUM(ti.amount), 0) AS total_investimentos,
    COALESCE(AVG(s.net_value), 0) AS media_ticket,
    COUNT(DISTINCT p.id) AS total_prospects,
    COUNT(DISTINCT CASE WHEN p.status = 'ganho' THEN p.id END) AS prospects_convertidos,
    CASE 
      WHEN COUNT(DISTINCT p.id) > 0 
      THEN ROUND((COUNT(DISTINCT CASE WHEN p.status = 'ganho' THEN p.id END)::NUMERIC / COUNT(DISTINCT p.id)::NUMERIC) * 100, 2)
      ELSE 0 
    END AS taxa_conversao,
    COUNT(DISTINCT a.id) AS total_atividades
  FROM public.municipios m
  LEFT JOIN public.stores st ON st.state = m.uf
  LEFT JOIN public.visits v ON v.store_id = st.id AND v.created_at::date = target_date
  LEFT JOIN public.sales s ON s.store_id = st.id AND s.sale_date = target_date
  LEFT JOIN public.trade_investments ti ON ti.store_id = st.id AND ti.investment_date = target_date
  LEFT JOIN public.prospects p ON p.municipio_id = m.id AND p.created_at::date <= target_date
  LEFT JOIN public.atividades a ON a.prospect_id = p.id AND a.data_atividade::date = target_date
  GROUP BY m.regiao, m.uf;
END;
$$;

-- 1.3 Função consume_budget_credit
CREATE OR REPLACE FUNCTION public.consume_budget_credit(p_budget_id uuid, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_available NUMERIC;
BEGIN
  -- Calcular saldo disponível
  SELECT (total_amount - COALESCE(spent_amount, 0) - COALESCE(reserved_amount, 0))
  INTO v_available
  FROM public.trade_budgets
  WHERE id = p_budget_id;
  
  -- Verificar se há saldo suficiente
  IF v_available < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente na verba. Disponível: R$ %, Necessário: R$ %', v_available, p_amount;
  END IF;
  
  -- Atualizar spent_amount
  UPDATE public.trade_budgets
  SET spent_amount = COALESCE(spent_amount, 0) + p_amount,
      updated_at = now()
  WHERE id = p_budget_id;
END;
$$;

-- 2. PROTEGER MATERIALIZED VIEWS
-- Revogar acesso SELECT dos roles anon, authenticated e public

-- 2.1 mv_sales_performance
REVOKE SELECT ON public.mv_sales_performance FROM anon;
REVOKE SELECT ON public.mv_sales_performance FROM authenticated;
REVOKE SELECT ON public.mv_sales_performance FROM public;

-- 2.2 mv_conversion_funnel
REVOKE SELECT ON public.mv_conversion_funnel FROM anon;
REVOKE SELECT ON public.mv_conversion_funnel FROM authenticated;
REVOKE SELECT ON public.mv_conversion_funnel FROM public;

-- 2.3 mv_trade_performance
REVOKE SELECT ON public.mv_trade_performance FROM anon;
REVOKE SELECT ON public.mv_trade_performance FROM authenticated;
REVOKE SELECT ON public.mv_trade_performance FROM public;

-- Conceder acesso apenas para service_role (backend)
GRANT SELECT ON public.mv_sales_performance TO service_role;
GRANT SELECT ON public.mv_conversion_funnel TO service_role;
GRANT SELECT ON public.mv_trade_performance TO service_role;

-- 3. COMENTÁRIOS DE SEGURANÇA
COMMENT ON FUNCTION public.sincronizar_permissoes_usuario IS 'Sincroniza permissões de telas baseado no role do usuário - SECURITY DEFINER com search_path vazio';
COMMENT ON FUNCTION public.refresh_daily_kpis IS 'Atualiza KPIs diários agregados - SECURITY DEFINER com search_path vazio';
COMMENT ON FUNCTION public.consume_budget_credit IS 'Consome crédito de verba com validação - SECURITY DEFINER com search_path vazio';
COMMENT ON MATERIALIZED VIEW public.mv_sales_performance IS 'Acesso restrito ao service_role - Não exposto na API';
COMMENT ON MATERIALIZED VIEW public.mv_conversion_funnel IS 'Acesso restrito ao service_role - Não exposto na API';
COMMENT ON MATERIALIZED VIEW public.mv_trade_performance IS 'Acesso restrito ao service_role - Não exposto na API';