-- Semana 4: Correção de Segurança - Function Search Path
-- Corrigir as 2 funções que estavam sem SET search_path

-- 1. Corrigir refresh_daily_kpis
CREATE OR REPLACE FUNCTION public.refresh_daily_kpis(target_date date DEFAULT (CURRENT_DATE - 1))
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

-- 2. Corrigir consume_budget_credit
CREATE OR REPLACE FUNCTION public.consume_budget_credit(p_budget_id uuid, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_available NUMERIC;
BEGIN
  SELECT (total_amount - COALESCE(spent_amount, 0) - COALESCE(reserved_amount, 0))
  INTO v_available
  FROM public.trade_budgets
  WHERE id = p_budget_id;
  
  IF v_available < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente na verba. Disponível: R$ %, Necessário: R$ %', v_available, p_amount;
  END IF;
  
  UPDATE public.trade_budgets
  SET spent_amount = COALESCE(spent_amount, 0) + p_amount,
      updated_at = now()
  WHERE id = p_budget_id;
END;
$function$;

COMMENT ON FUNCTION public.refresh_daily_kpis IS 'Semana 4: Corrigido search_path para segurança';
COMMENT ON FUNCTION public.consume_budget_credit IS 'Semana 4: Corrigido search_path para segurança';