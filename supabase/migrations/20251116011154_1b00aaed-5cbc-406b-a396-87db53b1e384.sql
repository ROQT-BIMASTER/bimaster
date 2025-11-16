-- ============================================
-- SEMANA 1: SEGURANÇA & ESTABILIDADE
-- ============================================

-- 1. Criar tabela para armazenar credenciais de redes sociais com segurança
CREATE TABLE IF NOT EXISTS public.social_media_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'twitter', 'youtube', 'linkedin', 'tiktok')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, platform)
);

-- Habilitar RLS na tabela de credenciais
ALTER TABLE public.social_media_credentials ENABLE ROW LEVEL SECURITY;

-- Política: usuários gerenciam apenas suas próprias credenciais
CREATE POLICY "Users manage own social media credentials"
ON public.social_media_credentials
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_social_media_credentials_updated_at
BEFORE UPDATE ON public.social_media_credentials
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 2. Tornar storage buckets PRIVADOS para segurança
UPDATE storage.buckets 
SET public = false 
WHERE name IN ('trade-photos', 'reward-banners');

-- 3. Adicionar políticas RLS aos buckets de storage
CREATE POLICY "Users can view own trade photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'trade-photos' AND
  (
    -- Admins veem tudo
    has_role(auth.uid(), 'admin') OR
    -- Supervisores veem fotos de subordinados
    (has_role(auth.uid(), 'supervisor') AND 
     EXISTS (
       SELECT 1 FROM photos p
       WHERE p.photo_url = storage.objects.name
       AND (p.vendedor_id = auth.uid() OR is_supervisor_of(auth.uid(), p.vendedor_id))
     )) OR
    -- Vendedores veem apenas suas fotos
    EXISTS (
      SELECT 1 FROM photos p
      WHERE p.photo_url = storage.objects.name
      AND p.vendedor_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can upload trade photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'trade-photos' AND
  (has_role(auth.uid(), 'admin') OR 
   has_role(auth.uid(), 'supervisor') OR 
   has_role(auth.uid(), 'vendedor') OR
   has_role(auth.uid(), 'promotor'))
);

CREATE POLICY "Users can delete own trade photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'trade-photos' AND
  (
    has_role(auth.uid(), 'admin') OR
    EXISTS (
      SELECT 1 FROM photos p
      WHERE p.photo_url = storage.objects.name
      AND p.vendedor_id = auth.uid()
    )
  )
);

CREATE POLICY "Anyone can view reward banners"
ON storage.objects FOR SELECT
USING (bucket_id = 'reward-banners');

CREATE POLICY "Admins manage reward banners"
ON storage.objects FOR ALL
USING (bucket_id = 'reward-banners' AND has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'reward-banners' AND has_role(auth.uid(), 'admin'));

-- 4. Corrigir funções sem SET search_path (segurança)
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

-- 5. Proteger materialized views - remover acesso público
REVOKE ALL ON public.mv_sales_performance FROM anon, authenticated;
REVOKE ALL ON public.mv_conversion_funnel FROM anon, authenticated;
REVOKE ALL ON public.mv_trade_performance FROM anon, authenticated;

-- Permitir apenas service_role (backend) acessar
GRANT SELECT ON public.mv_sales_performance TO service_role;
GRANT SELECT ON public.mv_conversion_funnel TO service_role;
GRANT SELECT ON public.mv_trade_performance TO service_role;

-- Admins podem consultar via funções protegidas
CREATE OR REPLACE FUNCTION public.get_sales_performance()
RETURNS SETOF public.mv_sales_performance
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.mv_sales_performance
  WHERE has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor');
$$;

CREATE OR REPLACE FUNCTION public.get_conversion_funnel()
RETURNS SETOF public.mv_conversion_funnel
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.mv_conversion_funnel
  WHERE has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor');
$$;

CREATE OR REPLACE FUNCTION public.get_trade_performance()
RETURNS SETOF public.mv_trade_performance
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.mv_trade_performance
  WHERE has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor');
$$;

-- 6. Criar tabela de audit logs expandida para compliance
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index para queries rápidas
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- RLS para audit logs (apenas admins veem)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins view audit logs"
ON public.audit_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Função auxiliar para registrar audit log
CREATE OR REPLACE FUNCTION public.log_audit(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    metadata
  ) VALUES (
    auth.uid(),
    p_action,
    p_entity_type,
    p_entity_id,
    p_old_data,
    p_new_data,
    p_metadata
  ) RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;