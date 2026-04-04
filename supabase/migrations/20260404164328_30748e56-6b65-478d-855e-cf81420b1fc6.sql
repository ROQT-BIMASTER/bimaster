-- ============================================
-- SEC-13: RLS Hardening — 4 tabelas com SELECT público
-- ============================================

-- 1. fabrica_ficha_custo_config — SELECT USING(true) para public
DROP POLICY IF EXISTS "Users can view ficha custo config" ON public.fabrica_ficha_custo_config;
DROP POLICY IF EXISTS "Users can insert ficha custo config" ON public.fabrica_ficha_custo_config;
DROP POLICY IF EXISTS "Users can update ficha custo config" ON public.fabrica_ficha_custo_config;
DROP POLICY IF EXISTS "Users can delete ficha custo config" ON public.fabrica_ficha_custo_config;

CREATE POLICY "Authenticated users can view ficha custo config"
  ON public.fabrica_ficha_custo_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin/supervisor can insert ficha custo config"
  ON public.fabrica_ficha_custo_config FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admin/supervisor can update ficha custo config"
  ON public.fabrica_ficha_custo_config FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admin/supervisor can delete ficha custo config"
  ON public.fabrica_ficha_custo_config FOR DELETE
  TO authenticated
  USING (public.is_admin_or_supervisor(auth.uid()));

-- 2. marketing_task_comments — SELECT USING(true) para public
DROP POLICY IF EXISTS "Users can view task comments" ON public.marketing_task_comments;

CREATE POLICY "Authenticated users can view task comments"
  ON public.marketing_task_comments FOR SELECT
  TO authenticated
  USING (true);

-- Also fix INSERT/UPDATE to authenticated
DROP POLICY IF EXISTS "Users can insert comments" ON public.marketing_task_comments;
DROP POLICY IF EXISTS "Users can update own comments" ON public.marketing_task_comments;

CREATE POLICY "Authenticated users can insert comments"
  ON public.marketing_task_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update own comments"
  ON public.marketing_task_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. user_rankings — SELECT USING(true) para public
DROP POLICY IF EXISTS "Todos podem ver rankings" ON public.user_rankings;

-- Keep the authenticated one (user_rankings_select already exists for authenticated)
-- Just remove the public one

-- 4. planos — SELECT para public (expõe stripe IDs)
DROP POLICY IF EXISTS "Todos podem visualizar planos ativos" ON public.planos;

CREATE POLICY "Authenticated users can view active planos"
  ON public.planos FOR SELECT
  TO authenticated
  USING (ativo = true);