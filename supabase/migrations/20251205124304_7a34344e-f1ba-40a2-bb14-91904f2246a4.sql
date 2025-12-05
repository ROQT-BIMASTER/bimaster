-- =============================================
-- FIX SECURITY: Restrict contas_pagar to finance users
-- =============================================

-- Drop overly permissive policies on contas_pagar
DROP POLICY IF EXISTS "Sistema pode gerenciar contas a pagar" ON contas_pagar;
DROP POLICY IF EXISTS "Usuários aprovados podem ver contas a pagar" ON contas_pagar;

-- Create proper restricted policies for contas_pagar
-- Only finance module users and admins can view
CREATE POLICY "Usuários financeiro podem ver contas a pagar"
ON contas_pagar FOR SELECT
USING (
  is_admin_or_supervisor(auth.uid()) OR
  usuario_tem_permissao_modulo(auth.uid(), 'financeiro')
);

-- Only admins and finance users can insert
CREATE POLICY "Usuários financeiro podem inserir contas a pagar"
ON contas_pagar FOR INSERT
WITH CHECK (
  is_admin_or_supervisor(auth.uid()) OR
  usuario_tem_permissao_modulo(auth.uid(), 'financeiro')
);

-- Only admins and finance users can update
CREATE POLICY "Usuários financeiro podem atualizar contas a pagar"
ON contas_pagar FOR UPDATE
USING (
  is_admin_or_supervisor(auth.uid()) OR
  usuario_tem_permissao_modulo(auth.uid(), 'financeiro')
);

-- Only admins can delete financial records
CREATE POLICY "Admins podem deletar contas a pagar"
ON contas_pagar FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- FIX SECURITY: Clean up profiles table policies
-- =============================================

-- Drop potentially overly permissive policies with public role
DROP POLICY IF EXISTS "Usuários veem próprio perfil RLS" ON profiles;
DROP POLICY IF EXISTS "Usuários atualizam próprio perfil RLS" ON profiles;
DROP POLICY IF EXISTS "Admins gerenciam perfis RLS" ON profiles;

-- Keep the proper authenticated policies that already exist:
-- "Usuários podem ver próprio perfil ou admins/supervisores veem" - already correct
-- "Usuários podem atualizar próprio perfil" - already correct
-- "Admins e supervisores podem atualizar perfis" - already correct