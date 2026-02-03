-- =====================================================
-- SECURITY HARDENING - FASE 2: Correções Finais
-- =====================================================

-- =====================================================
-- FASE 1: Remover políticas permissivas antigas de fabrica
-- =====================================================

DROP POLICY IF EXISTS "Usuários autenticados podem atualizar custos de produtos" ON public.fabrica_produto_custos;
DROP POLICY IF EXISTS "Usuários autenticados podem excluir custos de produtos" ON public.fabrica_produto_custos;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir custos de produtos" ON public.fabrica_produto_custos;
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar custos de produtos" ON public.fabrica_produto_custos;

DROP POLICY IF EXISTS "Usuários autenticados podem atualizar config de custos" ON public.fabrica_produto_custos_config;
DROP POLICY IF EXISTS "Usuários autenticados podem excluir config de custos" ON public.fabrica_produto_custos_config;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir config de custos" ON public.fabrica_produto_custos_config;
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar config de custos" ON public.fabrica_produto_custos_config;

-- =====================================================
-- FASE 2: Corrigir políticas de tabelas service_role
-- Estas tabelas são para uso interno e devem bloquear 
-- acesso de usuários autenticados normais
-- =====================================================

-- ai_training_examples - Remover política permissiva e criar bloqueio
DROP POLICY IF EXISTS "Service role can manage training examples" ON public.ai_training_examples;
CREATE POLICY "ai_training_block_authenticated"
ON public.ai_training_examples
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- n8n_cache_contas_receber - Já bloqueia mas precisa ser TO service_role
DROP POLICY IF EXISTS "n8n_cache_service_only" ON public.n8n_cache_contas_receber;
CREATE POLICY "n8n_cache_block_authenticated"
ON public.n8n_cache_contas_receber
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- n8n_sync_control - Já bloqueia mas precisa ser TO service_role
DROP POLICY IF EXISTS "n8n_sync_control_service_only" ON public.n8n_sync_control;
CREATE POLICY "n8n_sync_control_block_authenticated"
ON public.n8n_sync_control
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- sync_logs - Corrigir política
DROP POLICY IF EXISTS "sync_logs_service_only" ON public.sync_logs;
CREATE POLICY "sync_logs_block_authenticated"
ON public.sync_logs
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- sync_sessions - Corrigir política
DROP POLICY IF EXISTS "sync_sessions_service_only" ON public.sync_sessions;
CREATE POLICY "sync_sessions_block_authenticated"
ON public.sync_sessions
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- sync_tracking - Corrigir política
DROP POLICY IF EXISTS "sync_tracking_service_only" ON public.sync_tracking;
CREATE POLICY "sync_tracking_block_authenticated"
ON public.sync_tracking
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- =====================================================
-- FASE 3: Documentação
-- =====================================================

COMMENT ON POLICY "ai_training_block_authenticated" ON public.ai_training_examples IS 'Bloqueia acesso de usuários normais - apenas service_role pode acessar';
COMMENT ON POLICY "n8n_cache_block_authenticated" ON public.n8n_cache_contas_receber IS 'Bloqueia acesso de usuários normais - apenas service_role pode acessar';
COMMENT ON POLICY "n8n_sync_control_block_authenticated" ON public.n8n_sync_control IS 'Bloqueia acesso de usuários normais - apenas service_role pode acessar';
COMMENT ON POLICY "sync_logs_block_authenticated" ON public.sync_logs IS 'Bloqueia acesso de usuários normais - apenas service_role pode acessar';
COMMENT ON POLICY "sync_sessions_block_authenticated" ON public.sync_sessions IS 'Bloqueia acesso de usuários normais - apenas service_role pode acessar';
COMMENT ON POLICY "sync_tracking_block_authenticated" ON public.sync_tracking IS 'Bloqueia acesso de usuários normais - apenas service_role pode acessar';