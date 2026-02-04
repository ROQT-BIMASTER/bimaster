-- Usar função existente has_strict_finance_access para proteger clientes_perfil_credito

-- 1. Recriar função de acesso a dados de crédito usando funções existentes
CREATE OR REPLACE FUNCTION public.can_access_credit_data(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id
    AND (
      -- Admins têm acesso total (verificar via user_roles)
      EXISTS (
        SELECT 1 FROM public.user_roles ur 
        WHERE ur.user_id = _user_id AND ur.role = 'admin'
      )
      -- Ou usuários do departamento Financeiro, Crédito ou Cobrança
      OR p.departamento_id IN (
        SELECT id FROM public.departamentos 
        WHERE nome ILIKE '%financ%' 
           OR nome ILIKE '%crédit%' 
           OR nome ILIKE '%credito%'
           OR nome ILIKE '%cobran%'
           OR nome ILIKE '%tesour%'
      )
    )
  )
$$;

-- 2. Recriar política de exclusão
DROP POLICY IF EXISTS "clientes_perfil_credito_delete" ON public.clientes_perfil_credito;

CREATE POLICY "clientes_perfil_credito_delete"
ON public.clientes_perfil_credito
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);