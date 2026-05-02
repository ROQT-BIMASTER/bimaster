-- 1) china_ficha_visibilidade: drop the permissive duplicate SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view visibility records" ON public.china_ficha_visibilidade;

-- 2) verbas_orcamentarias: replace permissive auth-only policies with role-scoped ones
DROP POLICY IF EXISTS "Usuários autenticados podem ver verbas orçamentárias" ON public.verbas_orcamentarias;
DROP POLICY IF EXISTS "Usuários autenticados podem criar verbas orçamentárias" ON public.verbas_orcamentarias;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar verbas orçamentárias" ON public.verbas_orcamentarias;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar verbas orçamentárias" ON public.verbas_orcamentarias;

CREATE POLICY "verbas_orc_select_finance"
ON public.verbas_orcamentarias
FOR SELECT
TO authenticated
USING (
  has_role((select auth.uid()), 'admin'::app_role)
  OR has_role((select auth.uid()), 'supervisor'::app_role)
  OR check_user_access((select auth.uid()), 'financeiro')
);

CREATE POLICY "verbas_orc_insert_finance"
ON public.verbas_orcamentarias
FOR INSERT
TO authenticated
WITH CHECK (
  has_role((select auth.uid()), 'admin'::app_role)
  OR check_user_access((select auth.uid()), 'financeiro')
);

CREATE POLICY "verbas_orc_update_finance"
ON public.verbas_orcamentarias
FOR UPDATE
TO authenticated
USING (
  has_role((select auth.uid()), 'admin'::app_role)
  OR check_user_access((select auth.uid()), 'financeiro')
)
WITH CHECK (
  has_role((select auth.uid()), 'admin'::app_role)
  OR check_user_access((select auth.uid()), 'financeiro')
);

CREATE POLICY "verbas_orc_delete_finance"
ON public.verbas_orcamentarias
FOR DELETE
TO authenticated
USING (
  has_role((select auth.uid()), 'admin'::app_role)
  OR check_user_access((select auth.uid()), 'financeiro')
);

-- 3) trade_banners: restrict SELECT to authenticated users (no anonymous read)
DROP POLICY IF EXISTS "Anyone can view active banners" ON public.trade_banners;

CREATE POLICY "trade_banners_authenticated_select"
ON public.trade_banners
FOR SELECT
TO authenticated
USING (true);
