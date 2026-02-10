
-- Fix remaining WITH CHECK (true) INSERT policies on fabrica tables

DROP POLICY IF EXISTS "Authenticated users can insert cost evidence" ON public.fabrica_custo_evidencias;
CREATE POLICY "Authenticated users can insert cost evidence" ON public.fabrica_custo_evidencias
  FOR INSERT TO authenticated
  WITH CHECK (can_access_fabrica(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert cost history" ON public.fabrica_insumo_custo_historico;
CREATE POLICY "Authenticated users can insert cost history" ON public.fabrica_insumo_custo_historico
  FOR INSERT TO authenticated
  WITH CHECK (can_access_fabrica(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.fabrica_revisao_mensagens;
CREATE POLICY "Authenticated users can insert messages" ON public.fabrica_revisao_mensagens
  FOR INSERT TO authenticated
  WITH CHECK (can_access_fabrica(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert requisitos" ON public.fabrica_revisao_requisitos;
CREATE POLICY "Authenticated users can insert requisitos" ON public.fabrica_revisao_requisitos
  FOR INSERT TO authenticated
  WITH CHECK (can_access_fabrica(auth.uid()));
