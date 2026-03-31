
-- 1. configuracoes_cobranca: restringir INSERT/UPDATE/DELETE a admin only
DROP POLICY IF EXISTS "Admins e supervisores podem inserir configurações" ON public.configuracoes_cobranca;
DROP POLICY IF EXISTS "Admins e supervisores podem atualizar configurações" ON public.configuracoes_cobranca;
DROP POLICY IF EXISTS "Supervisors and admins can manage" ON public.configuracoes_cobranca;

CREATE POLICY "configuracoes_cobranca_insert_admin"
ON public.configuracoes_cobranca FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "configuracoes_cobranca_update_admin"
ON public.configuracoes_cobranca FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "configuracoes_cobranca_delete_admin"
ON public.configuracoes_cobranca FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. trade_incentivos: remover acesso público, restringir a authenticated
DROP POLICY IF EXISTS "Anyone can view active incentivos" ON public.trade_incentivos;

CREATE POLICY "trade_incentivos_select_authenticated"
ON public.trade_incentivos FOR SELECT TO authenticated
USING (true);

-- 3. store_sellouts: drop old permissive policy que ainda existe
DROP POLICY IF EXISTS "Usuários autenticados podem ver sell outs" ON public.store_sellouts;
