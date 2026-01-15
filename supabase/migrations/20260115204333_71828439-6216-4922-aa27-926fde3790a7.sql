-- =====================================================
-- SECURITY FIX: Comprehensive RLS Policy Corrections
-- =====================================================

-- 1. Fix huggs_agent_config - Remove public access, restrict to admin only
DROP POLICY IF EXISTS "Todos podem ver configuração do agente" ON public.huggs_agent_config;
DROP POLICY IF EXISTS "Anyone can view agent config" ON public.huggs_agent_config;

CREATE POLICY "Only admins can view AI config"
ON public.huggs_agent_config FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update AI config"
ON public.huggs_agent_config FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Fix usuario_permissoes_modulos - Restrict to own permissions or admin
DROP POLICY IF EXISTS "Public read access" ON public.usuario_permissoes_modulos;
DROP POLICY IF EXISTS "Permitir leitura pública" ON public.usuario_permissoes_modulos;
DROP POLICY IF EXISTS "Anyone can read" ON public.usuario_permissoes_modulos;

CREATE POLICY "Users can view their own module permissions"
ON public.usuario_permissoes_modulos FOR SELECT
TO authenticated
USING (usuario_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 3. Fix cnpjbiz_cache - Restrict to authenticated users only
DROP POLICY IF EXISTS "Allow all operations" ON public.cnpjbiz_cache;
DROP POLICY IF EXISTS "Public access" ON public.cnpjbiz_cache;
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.cnpjbiz_cache;

CREATE POLICY "Authenticated users can read cache"
ON public.cnpjbiz_cache FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only service role can insert cache"
ON public.cnpjbiz_cache FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Only service role can update cache"
ON public.cnpjbiz_cache FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Only service role can delete cache"
ON public.cnpjbiz_cache FOR DELETE
TO service_role
USING (true);

-- 4. Fix n8n_sync_control - Restrict to admin only
DROP POLICY IF EXISTS "Enable all for all users" ON public.n8n_sync_control;
DROP POLICY IF EXISTS "Public read access" ON public.n8n_sync_control;
DROP POLICY IF EXISTS "Public access" ON public.n8n_sync_control;

CREATE POLICY "Only admins can view sync control"
ON public.n8n_sync_control FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can manage sync control"
ON public.n8n_sync_control FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Fix WhatsApp tables - Remove permissive INSERT policies
DROP POLICY IF EXISTS "Sistema pode inserir conversas" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Sistema pode inserir mensagens" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Allow system inserts" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Allow system inserts" ON public.whatsapp_messages;

-- WhatsApp inserts should only be done via service role (edge functions)
-- No policy needed as service_role bypasses RLS