-- =====================================================
-- SECURITY HARDENING - FULL MIGRATION
-- =====================================================

-- =====================================================
-- FASE 1: Criar Função de Acesso à Fábrica
-- =====================================================

CREATE OR REPLACE FUNCTION public.can_access_fabrica(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.is_admin_or_supervisor(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.usuario_permissoes_modulos upm
      INNER JOIN public.modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE upm.usuario_id = _user_id 
        AND ms.codigo = 'fabrica'
    )
$$;

-- =====================================================
-- FASE 2: Hardening das Tabelas de Custos de Fábrica
-- =====================================================

-- 2.1 fabrica_produto_custos - Remover políticas permissivas
DROP POLICY IF EXISTS "Authenticated users can view custos" ON public.fabrica_produto_custos;
DROP POLICY IF EXISTS "Authenticated users can insert custos" ON public.fabrica_produto_custos;
DROP POLICY IF EXISTS "Authenticated users can update custos" ON public.fabrica_produto_custos;
DROP POLICY IF EXISTS "Authenticated users can delete custos" ON public.fabrica_produto_custos;
DROP POLICY IF EXISTS "Users can view product costs" ON public.fabrica_produto_custos;
DROP POLICY IF EXISTS "Users can insert product costs" ON public.fabrica_produto_custos;
DROP POLICY IF EXISTS "Users can update product costs" ON public.fabrica_produto_custos;
DROP POLICY IF EXISTS "Users can delete product costs" ON public.fabrica_produto_custos;
DROP POLICY IF EXISTS "fabrica_custos_select" ON public.fabrica_produto_custos;
DROP POLICY IF EXISTS "fabrica_custos_insert" ON public.fabrica_produto_custos;
DROP POLICY IF EXISTS "fabrica_custos_update" ON public.fabrica_produto_custos;
DROP POLICY IF EXISTS "fabrica_custos_delete" ON public.fabrica_produto_custos;

-- 2.2 Criar novas políticas restritivas para fabrica_produto_custos
CREATE POLICY "fabrica_custos_select_restricted"
ON public.fabrica_produto_custos
FOR SELECT
TO authenticated
USING (public.can_access_fabrica(auth.uid()));

CREATE POLICY "fabrica_custos_insert_restricted"
ON public.fabrica_produto_custos
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_fabrica(auth.uid()));

CREATE POLICY "fabrica_custos_update_restricted"
ON public.fabrica_produto_custos
FOR UPDATE
TO authenticated
USING (public.can_access_fabrica(auth.uid()))
WITH CHECK (public.can_access_fabrica(auth.uid()));

CREATE POLICY "fabrica_custos_delete_admin_only"
ON public.fabrica_produto_custos
FOR DELETE
TO authenticated
USING (public.is_admin_or_supervisor(auth.uid()));

-- 2.3 fabrica_produto_custos_config - Remover políticas permissivas
DROP POLICY IF EXISTS "Authenticated users can view custos config" ON public.fabrica_produto_custos_config;
DROP POLICY IF EXISTS "Authenticated users can insert custos config" ON public.fabrica_produto_custos_config;
DROP POLICY IF EXISTS "Authenticated users can update custos config" ON public.fabrica_produto_custos_config;
DROP POLICY IF EXISTS "Authenticated users can delete custos config" ON public.fabrica_produto_custos_config;
DROP POLICY IF EXISTS "Users can view cost config" ON public.fabrica_produto_custos_config;
DROP POLICY IF EXISTS "Users can insert cost config" ON public.fabrica_produto_custos_config;
DROP POLICY IF EXISTS "Users can update cost config" ON public.fabrica_produto_custos_config;
DROP POLICY IF EXISTS "Users can delete cost config" ON public.fabrica_produto_custos_config;
DROP POLICY IF EXISTS "fabrica_config_select" ON public.fabrica_produto_custos_config;
DROP POLICY IF EXISTS "fabrica_config_insert" ON public.fabrica_produto_custos_config;
DROP POLICY IF EXISTS "fabrica_config_update" ON public.fabrica_produto_custos_config;
DROP POLICY IF EXISTS "fabrica_config_delete" ON public.fabrica_produto_custos_config;

-- 2.4 Criar novas políticas restritivas para fabrica_produto_custos_config
CREATE POLICY "fabrica_config_select_restricted"
ON public.fabrica_produto_custos_config
FOR SELECT
TO authenticated
USING (public.can_access_fabrica(auth.uid()));

CREATE POLICY "fabrica_config_insert_restricted"
ON public.fabrica_produto_custos_config
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_fabrica(auth.uid()));

CREATE POLICY "fabrica_config_update_restricted"
ON public.fabrica_produto_custos_config
FOR UPDATE
TO authenticated
USING (public.can_access_fabrica(auth.uid()))
WITH CHECK (public.can_access_fabrica(auth.uid()));

CREATE POLICY "fabrica_config_delete_admin_only"
ON public.fabrica_produto_custos_config
FOR DELETE
TO authenticated
USING (public.is_admin_or_supervisor(auth.uid()));

-- =====================================================
-- FASE 3: Consolidar Políticas de Trade Budgets
-- =====================================================

-- 3.1 Remover todas as políticas existentes
DROP POLICY IF EXISTS "Users can view own budgets" ON public.trade_budgets;
DROP POLICY IF EXISTS "Users can view budgets" ON public.trade_budgets;
DROP POLICY IF EXISTS "Admins can view all budgets" ON public.trade_budgets;
DROP POLICY IF EXISTS "trade_budgets_select" ON public.trade_budgets;
DROP POLICY IF EXISTS "trade_budgets_select_own" ON public.trade_budgets;
DROP POLICY IF EXISTS "trade_budgets_select_admin" ON public.trade_budgets;
DROP POLICY IF EXISTS "Users can insert budgets" ON public.trade_budgets;
DROP POLICY IF EXISTS "Users can create budgets" ON public.trade_budgets;
DROP POLICY IF EXISTS "trade_budgets_insert" ON public.trade_budgets;
DROP POLICY IF EXISTS "trade_budgets_insert_own" ON public.trade_budgets;
DROP POLICY IF EXISTS "Users can update own budgets" ON public.trade_budgets;
DROP POLICY IF EXISTS "Users can update budgets" ON public.trade_budgets;
DROP POLICY IF EXISTS "Admins can update all budgets" ON public.trade_budgets;
DROP POLICY IF EXISTS "trade_budgets_update" ON public.trade_budgets;
DROP POLICY IF EXISTS "trade_budgets_update_own" ON public.trade_budgets;
DROP POLICY IF EXISTS "trade_budgets_update_admin" ON public.trade_budgets;
DROP POLICY IF EXISTS "Users can delete own budgets" ON public.trade_budgets;
DROP POLICY IF EXISTS "Admins can delete budgets" ON public.trade_budgets;
DROP POLICY IF EXISTS "trade_budgets_delete" ON public.trade_budgets;
DROP POLICY IF EXISTS "trade_budgets_delete_own" ON public.trade_budgets;
DROP POLICY IF EXISTS "trade_budgets_delete_admin" ON public.trade_budgets;

-- 3.2 Criar função auxiliar para verificar acesso a budgets
CREATE OR REPLACE FUNCTION public.can_access_trade_budget(_user_id uuid, _budget_created_by uuid, _budget_requested_by uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- É o criador ou solicitante
    _user_id = _budget_created_by
    OR _user_id = _budget_requested_by
    -- É admin ou supervisor
    OR public.is_admin_or_supervisor(_user_id)
    -- Tem acesso aos módulos relevantes
    OR EXISTS (
      SELECT 1 FROM public.usuario_permissoes_modulos upm
      INNER JOIN public.modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE upm.usuario_id = _user_id 
        AND ms.codigo IN ('marketing', 'financeiro', 'trade')
    )
$$;

-- 3.3 Criar políticas consolidadas para trade_budgets
CREATE POLICY "trade_budgets_select_consolidated"
ON public.trade_budgets
FOR SELECT
TO authenticated
USING (
  public.can_access_trade_budget(auth.uid(), created_by, requested_by)
);

CREATE POLICY "trade_budgets_insert_consolidated"
ON public.trade_budgets
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  OR public.is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "trade_budgets_update_admin_supervisor"
ON public.trade_budgets
FOR UPDATE
TO authenticated
USING (public.is_admin_or_supervisor(auth.uid()))
WITH CHECK (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "trade_budgets_delete_admin_only"
ON public.trade_budgets
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- FASE 4: Consolidar Políticas de Bank Accounts
-- =====================================================

-- 4.1 Remover políticas duplicadas
DROP POLICY IF EXISTS "Users can view bank accounts" ON public.trade_bank_accounts;
DROP POLICY IF EXISTS "Authenticated users can view bank accounts" ON public.trade_bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_select" ON public.trade_bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_select_finance" ON public.trade_bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_select_finance_only" ON public.trade_bank_accounts;

-- 4.2 Criar política consolidada única
CREATE POLICY "bank_accounts_select_consolidated"
ON public.trade_bank_accounts
FOR SELECT
TO authenticated
USING (public.can_access_bank_accounts(auth.uid()));

-- =====================================================
-- FASE 5: Proteger sync_rate_limiter
-- =====================================================

-- 5.1 Habilitar RLS
ALTER TABLE IF EXISTS public.sync_rate_limiter ENABLE ROW LEVEL SECURITY;

-- 5.2 Remover políticas existentes se houver
DROP POLICY IF EXISTS "sync_rate_limiter_select" ON public.sync_rate_limiter;
DROP POLICY IF EXISTS "sync_rate_limiter_insert" ON public.sync_rate_limiter;
DROP POLICY IF EXISTS "sync_rate_limiter_update" ON public.sync_rate_limiter;
DROP POLICY IF EXISTS "sync_rate_limiter_delete" ON public.sync_rate_limiter;

-- 5.3 Bloquear acesso de usuários normais (apenas service_role pode acessar)
CREATE POLICY "sync_rate_limiter_service_only"
ON public.sync_rate_limiter
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- =====================================================
-- FASE 6: Adicionar comentários de documentação
-- =====================================================

COMMENT ON FUNCTION public.can_access_fabrica IS 'Verifica se usuário tem acesso ao módulo fábrica (admin/supervisor ou módulo habilitado)';
COMMENT ON FUNCTION public.can_access_trade_budget IS 'Verifica se usuário pode acessar um budget específico (criador, solicitante, admin, ou módulos relevantes)';
COMMENT ON POLICY "fabrica_custos_select_restricted" ON public.fabrica_produto_custos IS 'Apenas usuários com acesso ao módulo fábrica podem visualizar custos';
COMMENT ON POLICY "fabrica_custos_delete_admin_only" ON public.fabrica_produto_custos IS 'Apenas admin/supervisor podem excluir custos';
COMMENT ON POLICY "trade_budgets_delete_admin_only" ON public.trade_budgets IS 'Apenas admins podem excluir budgets';
COMMENT ON POLICY "sync_rate_limiter_service_only" ON public.sync_rate_limiter IS 'Tabela restrita a service_role - bloqueada para usuários normais';