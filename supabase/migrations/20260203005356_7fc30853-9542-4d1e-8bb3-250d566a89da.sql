-- =============================================
-- SECURITY HARDENING - FINAL FIX
-- =============================================

-- 1. FUNÇÃO: Verificar acesso a contas bancárias (apenas finance/admin)
DROP FUNCTION IF EXISTS public.can_access_bank_accounts(uuid);

CREATE FUNCTION public.can_access_bank_accounts(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _dept_nome text;
  _is_admin_or_super boolean;
BEGIN
  -- Admins e supervisores têm acesso
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin', 'supervisor')
  ) INTO _is_admin_or_super;
  
  IF _is_admin_or_super THEN
    RETURN true;
  END IF;
  
  -- Verificar se está no departamento financeiro
  SELECT d.nome INTO _dept_nome
  FROM public.profiles p
  JOIN public.departamentos d ON d.id = p.departamento_id
  WHERE p.id = _user_id;
  
  -- Aceitar departamentos financeiros
  IF _dept_nome IS NOT NULL AND (
    lower(_dept_nome) LIKE '%financ%' OR 
    lower(_dept_nome) LIKE '%tesour%' OR
    lower(_dept_nome) LIKE '%contab%'
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- 2. TRADE_BANK_ACCOUNTS: Aplicar política restritiva
DROP POLICY IF EXISTS "Users see accounts for managed stores" ON public.trade_bank_accounts;
DROP POLICY IF EXISTS "trade_bank_accounts_select_policy" ON public.trade_bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_select_finance_only" ON public.trade_bank_accounts;

CREATE POLICY "bank_accounts_select_finance_only"
ON public.trade_bank_accounts FOR SELECT
TO authenticated
USING (public.can_access_bank_accounts(auth.uid()));

-- 3. ADS_ACCOUNTS: Bloquear acesso direto às credenciais
DROP VIEW IF EXISTS public.ads_accounts_safe;

CREATE VIEW public.ads_accounts_safe
WITH (security_invoker = true)
AS SELECT 
  id,
  user_id,
  platform,
  account_id,
  account_name,
  is_active,
  sync_status,
  last_sync_at,
  created_at,
  updated_at
FROM public.ads_accounts;

-- Remover políticas antigas e criar bloqueio
DROP POLICY IF EXISTS "Users see own ads accounts" ON public.ads_accounts;
DROP POLICY IF EXISTS "ads_accounts_select_own" ON public.ads_accounts;
DROP POLICY IF EXISTS "Users can view their own accounts" ON public.ads_accounts;
DROP POLICY IF EXISTS "ads_accounts_no_direct_select" ON public.ads_accounts;

CREATE POLICY "ads_accounts_no_direct_select"
ON public.ads_accounts FOR SELECT
TO authenticated
USING (false);

-- Políticas de modificação para owners
DROP POLICY IF EXISTS "Users can insert own accounts" ON public.ads_accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON public.ads_accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON public.ads_accounts;
DROP POLICY IF EXISTS "ads_accounts_insert_own" ON public.ads_accounts;
DROP POLICY IF EXISTS "ads_accounts_update_own" ON public.ads_accounts;
DROP POLICY IF EXISTS "ads_accounts_delete_own" ON public.ads_accounts;

CREATE POLICY "ads_accounts_insert_own"
ON public.ads_accounts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ads_accounts_update_own"
ON public.ads_accounts FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "ads_accounts_delete_own"
ON public.ads_accounts FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 4. Tabela de log para auditoria de acesso sensível
CREATE TABLE IF NOT EXISTS public.sensitive_data_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL,
  accessed_at timestamptz DEFAULT now(),
  ip_address inet,
  user_agent text
);

ALTER TABLE public.sensitive_data_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sensitive_log_admin_only" ON public.sensitive_data_access_log;
DROP POLICY IF EXISTS "sensitive_log_insert_any" ON public.sensitive_data_access_log;

CREATE POLICY "sensitive_log_admin_only"
ON public.sensitive_data_access_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "sensitive_log_insert_any"
ON public.sensitive_data_access_log FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sensitive_log_user ON public.sensitive_data_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_sensitive_log_table ON public.sensitive_data_access_log(table_name);
CREATE INDEX IF NOT EXISTS idx_sensitive_log_accessed ON public.sensitive_data_access_log(accessed_at);

-- Documentação
COMMENT ON FUNCTION public.can_access_bank_accounts IS 'Verifica se usuário pode acessar contas bancárias - apenas finance/admin/supervisor';
COMMENT ON VIEW public.ads_accounts_safe IS 'View segura de ads_accounts SEM credenciais expostas';
COMMENT ON TABLE public.sensitive_data_access_log IS 'Log de acesso a dados sensíveis para auditoria';