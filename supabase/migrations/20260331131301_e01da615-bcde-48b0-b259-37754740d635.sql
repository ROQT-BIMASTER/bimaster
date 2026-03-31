
-- Fix remaining errors and warnings

-- 1. Remove duplicate broad SELECT policies on storage buckets
DROP POLICY IF EXISTS "Auth users can read attachments" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can read campaign-evidence" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can read fabrica-cotacoes" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can read trade-budget-docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view expense docs" ON storage.objects;
DROP POLICY IF EXISTS "Auth users read projeto docs" ON storage.objects;

-- Replace with ownership-scoped policies
CREATE POLICY "attachments_select_owned" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'attachments' AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin_or_supervisor(auth.uid())));

CREATE POLICY "trade_budget_docs_select_owned" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'trade-budget-docs' AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin_or_supervisor(auth.uid())));

-- 2. api_support_messages — restrict SELECT to own messages
DROP POLICY IF EXISTS "authenticated_read" ON public.api_support_messages;
CREATE POLICY "support_messages_select_own" ON public.api_support_messages
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin_or_supervisor(auth.uid()));

-- 3. Remove broad realtime tables that leak data
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'plano_contas_auditoria') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.plano_contas_auditoria;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'oms_pedidos') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.oms_pedidos;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'china_ordens_compra') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.china_ordens_compra;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'china_producao_apontamentos') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.china_producao_apontamentos;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'china_embarques') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.china_embarques;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'fluxo_aprovacao_instancias') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.fluxo_aprovacao_instancias;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'fluxo_aprovacao_transicoes') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.fluxo_aprovacao_transicoes;
  END IF;
END $$;

-- 4. erp_sync_log — remove broad policy, keep empresa-scoped
DROP POLICY IF EXISTS "erp_sync_log_select_authenticated" ON public.erp_sync_log;

-- 5. financial_payment_queue_history — restrict to financial roles
DROP POLICY IF EXISTS "Authenticated users can view history" ON public.financial_payment_queue_history;
CREATE POLICY "payment_queue_history_select_restricted" ON public.financial_payment_queue_history
  FOR SELECT TO authenticated
  USING (changed_by = auth.uid() OR is_admin_or_supervisor(auth.uid()) OR usuario_tem_permissao_modulo(auth.uid(), 'financeiro'));
