
-- ================================================================
-- CORREÇÃO DE SEGURANÇA: Remover políticas RLS "always true" restantes
-- Essas políticas representam riscos de segurança pois permitem acesso irrestrito
-- ================================================================

-- 1. fabrica_templates_lancamento - Restringir apenas para usuários com permissão
DROP POLICY IF EXISTS "Templates editáveis por usuários autenticados" ON public.fabrica_templates_lancamento;

CREATE POLICY "templates_lancamento_select" ON public.fabrica_templates_lancamento
FOR SELECT TO authenticated
USING (true); -- SELECT público é aceitável

CREATE POLICY "templates_lancamento_modify" ON public.fabrica_templates_lancamento
FOR ALL TO authenticated
USING (
  is_admin_or_supervisor(auth.uid()) OR
  usuario_tem_permissao_modulo(auth.uid(), 'marketing'::text)
)
WITH CHECK (
  is_admin_or_supervisor(auth.uid()) OR
  usuario_tem_permissao_modulo(auth.uid(), 'marketing'::text)
);

-- 2. user_challenge_progress - Restringir para o próprio usuário ou admins
DROP POLICY IF EXISTS "Sistema atualiza progresso" ON public.user_challenge_progress;

CREATE POLICY "user_challenge_progress_select" ON public.user_challenge_progress
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR is_admin_or_supervisor(auth.uid()));

CREATE POLICY "user_challenge_progress_update" ON public.user_challenge_progress
FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR is_admin_or_supervisor(auth.uid()))
WITH CHECK (user_id = auth.uid() OR is_admin_or_supervisor(auth.uid()));

CREATE POLICY "user_challenge_progress_insert" ON public.user_challenge_progress
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR is_admin_or_supervisor(auth.uid()));

-- 3. user_rankings - Restringir para o próprio usuário ou admins  
DROP POLICY IF EXISTS "Sistema atualiza rankings automaticamente" ON public.user_rankings;

CREATE POLICY "user_rankings_select" ON public.user_rankings
FOR SELECT TO authenticated
USING (true); -- Rankings podem ser públicos para visualização

CREATE POLICY "user_rankings_modify" ON public.user_rankings
FOR ALL TO authenticated
USING (user_id = auth.uid() OR is_admin_or_supervisor(auth.uid()))
WITH CHECK (user_id = auth.uid() OR is_admin_or_supervisor(auth.uid()));

-- 4. cnpjbiz_cache - Restringir para service_role (já está correto, mas vamos consolidar)
DROP POLICY IF EXISTS "Acesso total ao cache" ON public.cnpjbiz_cache;
DROP POLICY IF EXISTS "Only service role can insert cache" ON public.cnpjbiz_cache;
DROP POLICY IF EXISTS "Only service role can update cache" ON public.cnpjbiz_cache;
DROP POLICY IF EXISTS "Only service role can delete cache" ON public.cnpjbiz_cache;

-- Cache é gerenciado apenas pelo service role, sem acesso via RLS para usuários normais
CREATE POLICY "cnpjbiz_cache_service_only" ON public.cnpjbiz_cache
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- 5. Tabelas de sync - Apenas service_role
DROP POLICY IF EXISTS "Service role full access cache" ON public.n8n_cache_contas_receber;
DROP POLICY IF EXISTS "Service role full access control" ON public.n8n_sync_control;
DROP POLICY IF EXISTS "Service role can manage sync_logs" ON public.sync_logs;
DROP POLICY IF EXISTS "sync_sessions_service_access" ON public.sync_sessions;
DROP POLICY IF EXISTS "Allow service role access on sync_tracking" ON public.sync_tracking;

-- Recriar políticas para service_role apenas
CREATE POLICY "n8n_cache_service_only" ON public.n8n_cache_contas_receber
FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "n8n_sync_control_service_only" ON public.n8n_sync_control
FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "sync_logs_service_only" ON public.sync_logs
FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "sync_sessions_service_only" ON public.sync_sessions
FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "sync_tracking_service_only" ON public.sync_tracking
FOR ALL TO service_role USING (true) WITH CHECK (true);
