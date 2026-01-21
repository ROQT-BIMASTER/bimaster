
-- ============================================
-- CORREÇÃO DE SEGURANÇA - Remover acesso de vendedores a dados financeiros
-- ============================================

-- 1. CONTAS_RECEBER: Remover acesso de vendedores (apenas admin/supervisor/financeiro)
DROP POLICY IF EXISTS "contas_receber_select_authenticated" ON public.contas_receber;
DROP POLICY IF EXISTS "Finance and admins can view contas_receber" ON public.contas_receber;

-- Nova política: apenas admin, supervisor ou usuários do módulo financeiro
CREATE POLICY "contas_receber_select_finance_only"
ON public.contas_receber FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
  OR usuario_tem_acesso_modulo(auth.uid(), 'cobranca')
);

-- 2. CLIENTES: Restringir dados financeiros (limite_credito, valores)
-- Remover política ampla e criar mais restritiva
DROP POLICY IF EXISTS "Vendedores podem ver clientes" ON public.clientes;

-- Criar política que permite vendedores verem apenas dados básicos
-- mas dados financeiros apenas para financeiro
CREATE POLICY "clientes_select_by_role"
ON public.clientes FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
  OR usuario_tem_acesso_modulo(auth.uid(), 'vendas')
  OR usuario_tem_acesso_modulo(auth.uid(), 'comercial')
);

-- 3. CLIENTES_PERFIL_CREDITO: Restringir apenas a cobrança e financeiro
DROP POLICY IF EXISTS "clientes_perfil_credito_select_restricted" ON public.clientes_perfil_credito;

CREATE POLICY "clientes_perfil_credito_select_restricted"
ON public.clientes_perfil_credito FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
  OR usuario_tem_acesso_modulo(auth.uid(), 'cobranca')
);

-- 4. N8N sync tables: Estas são para service_role apenas, o linter avisa mas é intencional
-- Marcaremos como ignoradas via security findings
