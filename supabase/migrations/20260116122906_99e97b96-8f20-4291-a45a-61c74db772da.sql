
-- ================================================================
-- CORREÇÃO DE SEGURANÇA: Remover políticas RLS muito permissivas
-- ================================================================

-- 1. TRADE_BUDGETS: Remover política SELECT que usa true (muito permissiva)
DROP POLICY IF EXISTS "Usuários autenticados podem ver orçamentos" ON public.trade_budgets;

-- 2. TRADE_BUDGETS: Remover políticas INSERT duplicadas/sem restrição
DROP POLICY IF EXISTS "Usuarios autenticados podem criar verbas" ON public.trade_budgets;
DROP POLICY IF EXISTS "Usuários podem solicitar orçamentos" ON public.trade_budgets;

-- 3. TRADE_BUDGETS: Criar política INSERT correta com restrição de owner
CREATE POLICY "trade_budgets_insert_owner" ON public.trade_budgets
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid() OR 
  requested_by = auth.uid() OR 
  is_admin_or_supervisor(auth.uid())
);

-- 4. CONTAS_RECEBER: Remover política ALL redundante para consolidar
DROP POLICY IF EXISTS "contas_receber_all" ON public.contas_receber;

-- 5. CLIENTES_PERFIL_CREDITO: Reforçar política SELECT para ser mais restritiva
DROP POLICY IF EXISTS "Credit team can view credit profiles" ON public.clientes_perfil_credito;

CREATE POLICY "clientes_perfil_credito_select_restricted" ON public.clientes_perfil_credito
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role) OR 
  (
    usuario_tem_permissao_modulo(auth.uid(), 'cobranca'::text) AND
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.departamento_id IN (
        SELECT id FROM departamentos 
        WHERE nome ILIKE '%financeiro%' OR nome ILIKE '%cobranca%' OR nome ILIKE '%credito%'
      )
    )
  )
);

-- 6. PROSPECTS: Consolidar políticas SELECT duplicadas (manter apenas as mais restritivas)
DROP POLICY IF EXISTS "Usuários veem prospects RLS" ON public.prospects;
DROP POLICY IF EXISTS "Vendedores veem apenas seus prospects" ON public.prospects;

-- A política prospects_select_owner_assigned_admin já cobre os casos necessários

-- 7. Criar função de auditoria para acesso a dados sensíveis
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    NEW.id,
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'timestamp', now()
    )
  );
  RETURN NEW;
END;
$$;

-- 8. Adicionar triggers de auditoria para tabelas sensíveis
DROP TRIGGER IF EXISTS audit_clientes_perfil_credito ON public.clientes_perfil_credito;
CREATE TRIGGER audit_clientes_perfil_credito
  AFTER INSERT OR UPDATE ON public.clientes_perfil_credito
  FOR EACH ROW
  EXECUTE FUNCTION public.log_sensitive_data_access();

DROP TRIGGER IF EXISTS audit_contas_receber ON public.contas_receber;
CREATE TRIGGER audit_contas_receber
  AFTER INSERT OR UPDATE ON public.contas_receber
  FOR EACH ROW
  EXECUTE FUNCTION public.log_sensitive_data_access();
