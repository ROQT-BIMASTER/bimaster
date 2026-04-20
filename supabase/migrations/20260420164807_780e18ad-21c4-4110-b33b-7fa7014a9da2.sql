-- PR-24 (Production Hardening): RLS pagamentos restrito por empresa via semi-join
-- Substitui authenticated_select_pagamentos (using=true → vazamento cross-tenant)
-- por política que verifica empresa_id do título pai (contas_pagar) contra user_empresas.

DROP POLICY IF EXISTS authenticated_select_pagamentos ON public.pagamentos;

CREATE POLICY authenticated_select_pagamentos
ON public.pagamentos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.contas_pagar cp
    WHERE cp.id = pagamentos.conta_pagar_id
      AND cp.empresa_id IN (
        SELECT ue.empresa_id
        FROM public.user_empresas ue
        WHERE ue.user_id = auth.uid()
      )
  )
  OR public.has_financial_role(auth.uid())
);