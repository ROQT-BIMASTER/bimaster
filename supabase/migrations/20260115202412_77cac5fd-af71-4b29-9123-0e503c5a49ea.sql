
-- PARTE 1: Remover políticas permissivas antigas (tabelas A-E)

-- access_audit_log
DROP POLICY IF EXISTS "Sistema pode inserir logs" ON public.access_audit_log;

-- cnpjbiz_audit
DROP POLICY IF EXISTS "Sistema pode inserir auditoria" ON public.cnpjbiz_audit;

-- cobrancas_enviadas
DROP POLICY IF EXISTS "Sistema pode inserir histórico" ON public.cobrancas_enviadas;

-- contas_pagar_historico
DROP POLICY IF EXISTS "Usuários autenticados podem inserir histórico" ON public.contas_pagar_historico;

-- conversas
DROP POLICY IF EXISTS "Usuários podem criar conversas" ON public.conversas;

-- estoque_sync_logs
DROP POLICY IF EXISTS "Service role pode inserir logs" ON public.estoque_sync_logs;
