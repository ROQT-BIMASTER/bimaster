
-- ================================================================
-- parcelas: restrict SELECT to financial roles only
-- ================================================================
DROP POLICY IF EXISTS authenticated_select_parcelas ON public.parcelas;

CREATE POLICY parcelas_select_financial
  ON public.parcelas
  FOR SELECT
  TO authenticated
  USING (public.has_financial_role((SELECT auth.uid())));

-- ================================================================
-- erp_pedidos_rubysp: scope SELECT to admin/supervisor or owning vendedor
-- ================================================================
DROP POLICY IF EXISTS rsp_ped_sel ON public.erp_pedidos_rubysp;

CREATE POLICY rsp_ped_sel_scoped
  ON public.erp_pedidos_rubysp
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_supervisor((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.dim_vendedor dv
      WHERE dv.user_id = (SELECT auth.uid())
        AND dv.cod_vend = public.erp_pedidos_rubysp.vendedor_id
    )
  );

-- ================================================================
-- estoque_* : replace "USING (true)" SELECT policies with scoped access
-- ================================================================

-- estoque_lote_interno
DROP POLICY IF EXISTS "auth read lote interno" ON public.estoque_lote_interno;
CREATE POLICY estoque_lote_interno_select
  ON public.estoque_lote_interno
  FOR SELECT
  TO authenticated
  USING (
    public.usuario_tem_acesso_estoque((SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'admin'::app_role)
  );

-- estoque_movimento
DROP POLICY IF EXISTS "auth read movimentos" ON public.estoque_movimento;
CREATE POLICY estoque_movimento_select
  ON public.estoque_movimento
  FOR SELECT
  TO authenticated
  USING (
    public.usuario_tem_acesso_estoque((SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'admin'::app_role)
  );

-- estoque_produto_nivel
DROP POLICY IF EXISTS epn_select_authenticated ON public.estoque_produto_nivel;
CREATE POLICY epn_select_scoped
  ON public.estoque_produto_nivel
  FOR SELECT
  TO authenticated
  USING (
    public.usuario_tem_acesso_estoque((SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'admin'::app_role)
  );

-- estoque_unificado_cache
DROP POLICY IF EXISTS "Auth can read estoque_unificado_cache" ON public.estoque_unificado_cache;
CREATE POLICY estoque_unificado_cache_select
  ON public.estoque_unificado_cache
  FOR SELECT
  TO authenticated
  USING (
    public.usuario_tem_acesso_estoque((SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'admin'::app_role)
  );
