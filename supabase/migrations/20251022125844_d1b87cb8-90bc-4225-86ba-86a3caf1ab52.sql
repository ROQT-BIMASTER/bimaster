-- Remover políticas antigas e criar novas para trade_chart_of_accounts
DROP POLICY IF EXISTS "Usuários autenticados podem criar contas contábeis" ON public.trade_chart_of_accounts;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar contas contábeis" ON public.trade_chart_of_accounts;

CREATE POLICY "Usuarios autenticados podem criar contas contabeis"
ON public.trade_chart_of_accounts
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Usuarios autenticados podem atualizar contas contabeis"
ON public.trade_chart_of_accounts
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Ajustar políticas para stores
DROP POLICY IF EXISTS "Apenas admins e supervisores gerenciam lojas" ON public.stores;
DROP POLICY IF EXISTS "Usuários autenticados podem criar lojas" ON public.stores;
DROP POLICY IF EXISTS "Usuários autenticados podem ver lojas" ON public.stores;
DROP POLICY IF EXISTS "Criadores podem atualizar suas lojas" ON public.stores;
DROP POLICY IF EXISTS "Apenas admins podem deletar lojas" ON public.stores;

CREATE POLICY "Usuarios autenticados podem criar lojas"
ON public.stores
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Usuarios autenticados podem ver lojas"
ON public.stores
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Criadores podem atualizar suas lojas"
ON public.stores
FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR is_admin_or_supervisor(auth.uid()))
WITH CHECK (created_by = auth.uid() OR is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Apenas admins podem deletar lojas"
ON public.stores
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Ajustar políticas para trade_budgets
DROP POLICY IF EXISTS "Usuários autenticados podem criar verbas" ON public.trade_budgets;
DROP POLICY IF EXISTS "Criadores podem atualizar suas verbas pendentes" ON public.trade_budgets;

CREATE POLICY "Usuarios autenticados podem criar verbas"
ON public.trade_budgets
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Criadores podem atualizar suas verbas"
ON public.trade_budgets
FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR is_admin_or_supervisor(auth.uid()))
WITH CHECK (created_by = auth.uid() OR is_admin_or_supervisor(auth.uid()));