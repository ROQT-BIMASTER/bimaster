
-- 1. Adicionar empresa_id nas tabelas que faltam
ALTER TABLE public.trade_campaigns 
  ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES public.empresas(id);

ALTER TABLE public.trade_investments 
  ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES public.empresas(id);

-- 2. trade_financial_entries — atualizar RLS com filtro empresa
DROP POLICY IF EXISTS "tfe_select" ON public.trade_financial_entries;
CREATE POLICY "tfe_select_empresa" ON public.trade_financial_entries
FOR SELECT TO authenticated
USING (
  (created_by = auth.uid() OR public.check_user_access(auth.uid(), 'trade'))
  AND public.user_has_empresa_access(auth.uid(), empresa_id)
);

DROP POLICY IF EXISTS "tfe_update" ON public.trade_financial_entries;
CREATE POLICY "tfe_update_empresa" ON public.trade_financial_entries
FOR UPDATE TO authenticated
USING (
  (created_by = auth.uid() OR public.check_user_access(auth.uid()))
  AND public.user_has_empresa_access(auth.uid(), empresa_id)
);

DROP POLICY IF EXISTS "tfe_delete" ON public.trade_financial_entries;
CREATE POLICY "tfe_delete_empresa" ON public.trade_financial_entries
FOR DELETE TO authenticated
USING (
  public.check_user_access(auth.uid())
  AND public.user_has_empresa_access(auth.uid(), empresa_id)
);

-- 3. trade_campaigns — atualizar RLS com filtro empresa
DROP POLICY IF EXISTS "trade_campaigns_user_select" ON public.trade_campaigns;
CREATE POLICY "tc_select_empresa" ON public.trade_campaigns
FOR SELECT TO authenticated
USING (
  (responsible_user_id = auth.uid() OR created_by = auth.uid() OR public.is_admin_or_supervisor(auth.uid()))
  AND public.user_has_empresa_access(auth.uid(), empresa_id)
);

DROP POLICY IF EXISTS "trade_campaigns_admin_supervisor_all" ON public.trade_campaigns;
CREATE POLICY "tc_all_empresa" ON public.trade_campaigns
FOR ALL TO authenticated
USING (
  public.is_admin_or_supervisor(auth.uid())
  AND public.user_has_empresa_access(auth.uid(), empresa_id)
);

-- 4. trade_investments — atualizar RLS com filtro empresa
DROP POLICY IF EXISTS "ti_select" ON public.trade_investments;
CREATE POLICY "ti_select_empresa" ON public.trade_investments
FOR SELECT TO authenticated
USING (
  (vendedor_id = auth.uid() OR created_by = auth.uid() OR public.check_user_access(auth.uid(), 'trade'))
  AND public.user_has_empresa_access(auth.uid(), empresa_id)
);

DROP POLICY IF EXISTS "ti_update" ON public.trade_investments;
CREATE POLICY "ti_update_empresa" ON public.trade_investments
FOR UPDATE TO authenticated
USING (
  (vendedor_id = auth.uid() OR public.check_user_access(auth.uid()))
  AND public.user_has_empresa_access(auth.uid(), empresa_id)
);

DROP POLICY IF EXISTS "ti_delete" ON public.trade_investments;
CREATE POLICY "ti_delete_empresa" ON public.trade_investments
FOR DELETE TO authenticated
USING (
  public.check_user_access(auth.uid())
  AND public.user_has_empresa_access(auth.uid(), empresa_id)
);
