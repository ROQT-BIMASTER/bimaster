
-- 1. Prospects: deny anonymous access
CREATE POLICY "prospects_deny_anon"
ON public.prospects
FOR ALL
TO anon
USING (false);

-- 2. Prospects: tighten UPDATE to require vendas module (not just any access)
DROP POLICY IF EXISTS "prospects_update" ON public.prospects;
CREATE POLICY "prospects_update"
ON public.prospects
FOR UPDATE
TO authenticated
USING (
  vendedor_id = auth.uid() OR check_user_access(auth.uid(), 'vendas')
)
WITH CHECK (
  vendedor_id = auth.uid() OR check_user_access(auth.uid(), 'vendas')
);

-- 3. Prospects: tighten DELETE to require vendas module
DROP POLICY IF EXISTS "prospects_delete" ON public.prospects;
CREATE POLICY "prospects_delete"
ON public.prospects
FOR DELETE
TO authenticated
USING (
  vendedor_id = auth.uid() OR check_user_access(auth.uid(), 'vendas')
);

-- 4. Contas receber: explicit deny DELETE for non-admins (defense in depth)
CREATE POLICY "cr_delete_admin_only"
ON public.contas_receber
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
