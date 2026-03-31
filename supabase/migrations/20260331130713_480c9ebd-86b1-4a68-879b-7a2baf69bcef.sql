
-- =====================================================
-- FASE 1: Correções Críticas de Segurança
-- =====================================================

-- 1. View configuracoes_cobranca_safe — remover colunas sensíveis
DROP VIEW IF EXISTS public.configuracoes_cobranca_safe;
CREATE VIEW public.configuracoes_cobranca_safe WITH (security_invoker = true) AS
SELECT 
  id,
  automacao_ativa,
  hora_inicio_envio,
  hora_fim_envio,
  max_envios_hora,
  intervalo_minimo_dias,
  email_remetente,
  nome_remetente,
  created_at,
  updated_at,
  created_by,
  updated_by
FROM configuracoes_cobranca;

-- 2. Realtime — remover tabelas financeiras sensíveis
DO $$
BEGIN
  -- Only drop if table is in publication
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'contas_pagar') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.contas_pagar;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'fornecedores') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.fornecedores;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'parcelas') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.parcelas;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'pagamentos') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.pagamentos;
  END IF;
END $$;

-- 3. Fornecedores — restringir SELECT a roles financeiros
DROP POLICY IF EXISTS "authenticated_select_fornecedores" ON public.fornecedores;
CREATE POLICY "select_fornecedores_by_role" ON public.fornecedores
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
    OR usuario_tem_permissao_modulo(auth.uid(), 'financeiro')
    OR usuario_tem_permissao_modulo(auth.uid(), 'fabrica')
  );

-- 4. leads_minerados — restringir por owner
DROP POLICY IF EXISTS "Authenticated users can read leads_minerados" ON public.leads_minerados;
DROP POLICY IF EXISTS "Authenticated users can insert leads_minerados" ON public.leads_minerados;
DROP POLICY IF EXISTS "Authenticated users can update leads_minerados" ON public.leads_minerados;
DROP POLICY IF EXISTS "Authenticated users can delete leads_minerados" ON public.leads_minerados;

CREATE POLICY "leads_select_owner_or_admin" ON public.leads_minerados
  FOR SELECT TO authenticated
  USING (minerado_por = auth.uid() OR is_admin_or_supervisor(auth.uid()));

CREATE POLICY "leads_insert_own" ON public.leads_minerados
  FOR INSERT TO authenticated
  WITH CHECK (minerado_por = auth.uid());

CREATE POLICY "leads_update_owner_or_admin" ON public.leads_minerados
  FOR UPDATE TO authenticated
  USING (minerado_por = auth.uid() OR is_admin_or_supervisor(auth.uid()));

CREATE POLICY "leads_delete_owner_or_admin" ON public.leads_minerados
  FOR DELETE TO authenticated
  USING (minerado_por = auth.uid() OR is_admin_or_supervisor(auth.uid()));

-- =====================================================
-- FASE 2: Warnings
-- =====================================================

-- 5. dynamic_form_responses — remover policy ampla
DROP POLICY IF EXISTS "Authenticated can view responses of active forms" ON public.dynamic_form_responses;
DROP POLICY IF EXISTS "Authenticated can view answers of active forms" ON public.dynamic_form_answers;

-- 6. Storage — ownership check nos 9 buckets
-- campaign-evidence
DROP POLICY IF EXISTS "campaign_evidence_select" ON storage.objects;
CREATE POLICY "campaign_evidence_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'campaign-evidence' AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin_or_supervisor(auth.uid())));

DROP POLICY IF EXISTS "campaign_evidence_update" ON storage.objects;
CREATE POLICY "campaign_evidence_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'campaign-evidence' AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin_or_supervisor(auth.uid())));

DROP POLICY IF EXISTS "campaign_evidence_delete" ON storage.objects;
CREATE POLICY "campaign_evidence_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'campaign-evidence' AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin_or_supervisor(auth.uid())));

-- china-documentos
DROP POLICY IF EXISTS "china_storage_select" ON storage.objects;
CREATE POLICY "china_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'china-documentos' AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin_or_supervisor(auth.uid())));

DROP POLICY IF EXISTS "china_storage_delete" ON storage.objects;
CREATE POLICY "china_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'china-documentos' AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin_or_supervisor(auth.uid())));

-- trade-expense-docs
DROP POLICY IF EXISTS "Auth users can read trade-expense-docs" ON storage.objects;
CREATE POLICY "trade_expense_docs_select_owned" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'trade-expense-docs' AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin_or_supervisor(auth.uid())));

-- fabrica-custo-evidencias
DROP POLICY IF EXISTS "Auth users can read fabrica-custo-evidencias" ON storage.objects;
CREATE POLICY "fabrica_custo_evidencias_select_owned" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'fabrica-custo-evidencias' AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin_or_supervisor(auth.uid())));

-- comprovantes
DROP POLICY IF EXISTS "comprovantes_select_authenticated" ON storage.objects;
CREATE POLICY "comprovantes_select_owned" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'comprovantes' AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin_or_supervisor(auth.uid())));

-- fabrica-revisao-docs
DROP POLICY IF EXISTS "fabrica_revisao_docs_select" ON storage.objects;
CREATE POLICY "fabrica_revisao_docs_select_owned" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'fabrica-revisao-docs' AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin_or_supervisor(auth.uid())));

-- department-expense-docs
DROP POLICY IF EXISTS "Allow authenticated users to view department expense docs" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can read department-expense-docs" ON storage.objects;
CREATE POLICY "department_expense_docs_select_owned" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'department-expense-docs' AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin_or_supervisor(auth.uid())));

-- event-expense-docs
DROP POLICY IF EXISTS "Auth users can read event-expense-docs" ON storage.objects;
CREATE POLICY "event_expense_docs_select_owned" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'event-expense-docs' AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin_or_supervisor(auth.uid())));

-- payment-chat-files
DROP POLICY IF EXISTS "Authenticated users can read payment chat files" ON storage.objects;
CREATE POLICY "payment_chat_files_select_owned" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payment-chat-files' AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin_or_supervisor(auth.uid())));
