CREATE POLICY "cph_insert" ON public.contas_pagar_historico FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'admin'));