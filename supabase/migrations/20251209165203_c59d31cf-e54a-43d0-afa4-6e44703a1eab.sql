-- Fix clientes_perfil_credito: restrict access to credit/collection team only
-- Previously allowed all 'financeiro' users to see all customer credit data

DROP POLICY IF EXISTS "Financeiro pode ver perfis de crédito" ON public.clientes_perfil_credito;

-- Only admin, supervisor, or users with 'cobranca' (collection) module permission can view credit profiles
CREATE POLICY "Credit team can view credit profiles" ON public.clientes_perfil_credito
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role) OR
  usuario_tem_permissao_modulo(auth.uid(), 'cobranca'::text)
);