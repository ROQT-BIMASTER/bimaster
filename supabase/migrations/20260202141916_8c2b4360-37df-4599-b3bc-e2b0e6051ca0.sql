-- Corrigir política permissiva de INSERT no trade_budget_audit_log
DROP POLICY IF EXISTS "Authenticated users can insert budget audit log" ON public.trade_budget_audit_log;

-- Nova política restritiva - apenas usuários autenticados podem inserir seus próprios logs
CREATE POLICY "Users can insert their own budget audit entries"
ON public.trade_budget_audit_log
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);