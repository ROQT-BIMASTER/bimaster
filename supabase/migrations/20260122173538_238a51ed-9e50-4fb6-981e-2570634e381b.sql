
-- =====================================================
-- SECURITY HARDENING MIGRATION v6
-- Corrige falhas de segurança críticas identificadas
-- =====================================================

-- 1. REMOVER VIEW antiga e recriar SEM credenciais
DROP VIEW IF EXISTS public.ads_accounts_safe CASCADE;

CREATE VIEW public.ads_accounts_safe WITH (security_invoker=on) AS
SELECT 
  id,
  user_id,
  platform,
  account_name,
  account_id,
  is_active,
  last_sync_at,
  sync_status,
  created_at,
  updated_at
FROM public.ads_accounts;

-- Remover coluna credentials (plaintext) - CRÍTICO para segurança
ALTER TABLE public.ads_accounts DROP COLUMN IF EXISTS credentials;

-- 2. CRIAR VIEW SEGURA para profiles (oculta email para não-admins)
DROP VIEW IF EXISTS public.profiles_safe CASCADE;
CREATE VIEW public.profiles_safe WITH (security_invoker=on) AS
SELECT 
  id,
  nome,
  status,
  aprovado,
  departamento_id,
  supervisor_id,
  gerente_id,
  created_at,
  updated_at,
  CASE 
    WHEN has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') 
    THEN email
    ELSE CONCAT(LEFT(email, 3), '***@', RIGHT(email, 4))
  END as email
FROM public.profiles;

-- 3. ATUALIZAR políticas de store_sellers para restringir acesso
DROP POLICY IF EXISTS "store_sellers_select_authorized" ON public.store_sellers;
DROP POLICY IF EXISTS "Sellers can view their own store assignments" ON public.store_sellers;

CREATE POLICY "store_sellers_select_restricted" ON public.store_sellers
FOR SELECT USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'supervisor') OR
  vendedor_id = auth.uid() OR
  usuario_tem_acesso_modulo(auth.uid(), 'vendas')
);

-- 4. REMOVER políticas USING(true) de tabelas de marketing/ads

-- ads_campaign_metrics
DROP POLICY IF EXISTS "Users can view campaign metrics" ON public.ads_campaign_metrics;
CREATE POLICY "ads_campaign_metrics_select_restricted" ON public.ads_campaign_metrics
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.ads_campaigns ac
    JOIN public.ads_accounts aa ON ac.account_id = aa.id
    WHERE ac.id = ads_campaign_metrics.campaign_id
    AND (aa.user_id = auth.uid() OR has_role(auth.uid(), 'admin'))
  )
);

-- ads_campaigns
DROP POLICY IF EXISTS "Users can view campaigns for their accounts" ON public.ads_campaigns;
CREATE POLICY "ads_campaigns_select_restricted" ON public.ads_campaigns
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.ads_accounts aa
    WHERE aa.id = ads_campaigns.account_id
    AND (aa.user_id = auth.uid() OR has_role(auth.uid(), 'admin'))
  )
);

-- analytics_metrics
DROP POLICY IF EXISTS "Users can view their analytics metrics" ON public.analytics_metrics;
CREATE POLICY "analytics_metrics_select_restricted" ON public.analytics_metrics
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.ads_accounts aa
    WHERE aa.id = analytics_metrics.account_id
    AND (aa.user_id = auth.uid() OR has_role(auth.uid(), 'admin'))
  )
);

-- ai_insights
DROP POLICY IF EXISTS "Usuários veem insights de suas entidades" ON public.ai_insights;
CREATE POLICY "ai_insights_select_restricted" ON public.ai_insights
FOR SELECT USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'supervisor') OR
  (entity_type = 'prospect' AND EXISTS (
    SELECT 1 FROM public.prospects p WHERE p.id = ai_insights.entity_id AND p.vendedor_id = auth.uid()
  ))
);

-- kpi_snapshots
DROP POLICY IF EXISTS "Everyone can view KPI snapshots" ON public.kpi_snapshots;
CREATE POLICY "kpi_snapshots_select_approved" ON public.kpi_snapshots
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.aprovado = true)
);

-- 5. CRIAR função auxiliar para verificar acesso financeiro estrito (usando nome ao invés de codigo)
CREATE OR REPLACE FUNCTION public.has_strict_finance_access(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    LEFT JOIN public.departamentos d ON p.departamento_id = d.id
    WHERE p.id = user_id
    AND p.aprovado = true
    AND (
      has_role(user_id, 'admin') OR
      has_role(user_id, 'supervisor') OR
      UPPER(d.nome) IN ('FINANCEIRO', 'TESOURARIA', 'COBRANCA', 'CONTABILIDADE', 'COBRANÇA', 'FINANÇAS')
    )
  );
$$;

-- 6. CRIAR tabela de log de acesso a dados sensíveis
CREATE TABLE IF NOT EXISTS public.sensitive_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  table_name text NOT NULL,
  action text NOT NULL,
  record_id text,
  accessed_at timestamptz DEFAULT now(),
  ip_address inet,
  user_agent text
);

ALTER TABLE public.sensitive_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can view access log" ON public.sensitive_access_log;
CREATE POLICY "Only admins can view access log" ON public.sensitive_access_log
FOR SELECT USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "System can insert access log" ON public.sensitive_access_log;
CREATE POLICY "System can insert access log" ON public.sensitive_access_log
FOR INSERT WITH CHECK (true);

-- 7. ÍNDICES para melhor performance das políticas RLS
CREATE INDEX IF NOT EXISTS idx_profiles_aprovado ON public.profiles(aprovado) WHERE aprovado = true;
CREATE INDEX IF NOT EXISTS idx_profiles_departamento ON public.profiles(departamento_id);
CREATE INDEX IF NOT EXISTS idx_ads_accounts_user ON public.ads_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_sensitive_access_log_user ON public.sensitive_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_sensitive_access_log_table ON public.sensitive_access_log(table_name);

-- 8. COMENTÁRIOS para documentação
COMMENT ON FUNCTION public.has_strict_finance_access IS 'Verifica acesso restrito a dados financeiros baseado em departamento e role';
COMMENT ON TABLE public.sensitive_access_log IS 'Log de auditoria para acesso a dados sensíveis';
COMMENT ON VIEW public.profiles_safe IS 'View segura de profiles com email mascarado para não-admins';
COMMENT ON VIEW public.ads_accounts_safe IS 'View segura de ads_accounts sem credenciais';
