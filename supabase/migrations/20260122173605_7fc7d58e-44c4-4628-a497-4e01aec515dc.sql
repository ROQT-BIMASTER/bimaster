
-- =====================================================
-- SECURITY HARDENING - CORRIGIR POLÍTICAS USING(true) RESTANTES
-- =====================================================

-- 1. fabrica_tarefas_ajuste_preco - restringir UPDATE e DELETE
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar tarefas de ajuste" ON public.fabrica_tarefas_ajuste_preco;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar tarefas de ajuste" ON public.fabrica_tarefas_ajuste_preco;

-- Substituir por políticas restritivas (apenas admin/supervisor ou criador)
CREATE POLICY "fabrica_tarefas_ajuste_update_restricted" ON public.fabrica_tarefas_ajuste_preco
FOR UPDATE USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'supervisor') OR
  usuario_tem_acesso_modulo(auth.uid(), 'fabrica')
);

CREATE POLICY "fabrica_tarefas_ajuste_delete_restricted" ON public.fabrica_tarefas_ajuste_preco
FOR DELETE USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'supervisor')
);

-- 2. As políticas de sync são para service_role e são intencionais
-- Vamos documentar com comentário que são para uso interno
COMMENT ON POLICY "n8n_cache_service_only" ON public.n8n_cache_contas_receber IS 'Política para service_role - acesso interno N8N';
COMMENT ON POLICY "n8n_sync_control_service_only" ON public.n8n_sync_control IS 'Política para service_role - acesso interno N8N';
COMMENT ON POLICY "sync_logs_service_only" ON public.sync_logs IS 'Política para service_role - acesso interno sync';
COMMENT ON POLICY "sync_sessions_service_only" ON public.sync_sessions IS 'Política para service_role - acesso interno sync';
COMMENT ON POLICY "sync_tracking_service_only" ON public.sync_tracking IS 'Política para service_role - acesso interno sync';
