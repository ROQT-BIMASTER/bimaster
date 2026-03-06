DROP POLICY IF EXISTS "Everyone can view active policies" ON public.financial_payment_policies;
CREATE POLICY "Authenticated can view active policies" ON public.financial_payment_policies
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can insert policies" ON public.financial_payment_policies;
CREATE POLICY "Admins can insert policies" ON public.financial_payment_policies
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY (ARRAY['admin'::public.app_role, 'supervisor'::public.app_role])
  ));

DROP POLICY IF EXISTS "Admins can delete policies" ON public.financial_payment_policies;
CREATE POLICY "Admins can delete policies" ON public.financial_payment_policies
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY (ARRAY['admin'::public.app_role, 'supervisor'::public.app_role])
  ));

DROP POLICY IF EXISTS "Admins can update policies" ON public.financial_payment_policies;
CREATE POLICY "Admins can update policies" ON public.financial_payment_policies
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY (ARRAY['admin'::public.app_role, 'supervisor'::public.app_role])
  ));

DROP POLICY IF EXISTS "Todos podem ver unidades de medida" ON public.fabrica_unidades_medida;