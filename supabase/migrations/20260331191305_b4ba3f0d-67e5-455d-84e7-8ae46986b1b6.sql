
-- =============================================
-- Fix 1: Realtime — remove sensitive tables
-- =============================================
ALTER PUBLICATION supabase_realtime DROP TABLE prospects;
ALTER PUBLICATION supabase_realtime DROP TABLE notifications;
ALTER PUBLICATION supabase_realtime DROP TABLE lead_activity_logs;
ALTER PUBLICATION supabase_realtime DROP TABLE visits;
ALTER PUBLICATION supabase_realtime DROP TABLE fabrica_revisao_documentos;

-- =============================================
-- Fix 2: process-attachments — restrict SELECT + INSERT + DELETE
-- =============================================
DROP POLICY "Authenticated users can read process attachments" ON storage.objects;
DROP POLICY "Authenticated users can upload process attachments" ON storage.objects;
DROP POLICY "Authenticated users can delete process attachments" ON storage.objects;

CREATE POLICY "process_attachments_select_owned" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'process-attachments'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin_or_supervisor(auth.uid())
  )
);

CREATE POLICY "process_attachments_insert_owned" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'process-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "process_attachments_delete_owned" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'process-attachments'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin_or_supervisor(auth.uid())
  )
);

-- =============================================
-- Fix 3: documento-anexos — restrict SELECT + INSERT + DELETE
-- =============================================
DROP POLICY "Authenticated users can read anexos" ON storage.objects;
DROP POLICY "Authenticated users can upload anexos" ON storage.objects;
DROP POLICY "Authenticated users can delete anexos" ON storage.objects;

CREATE POLICY "documento_anexos_select_owned" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documento-anexos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin_or_supervisor(auth.uid())
  )
);

CREATE POLICY "documento_anexos_insert_owned" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documento-anexos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "documento_anexos_delete_owned" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documento-anexos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin_or_supervisor(auth.uid())
  )
);

-- =============================================
-- Fix 4: projeto-anexos — restrict SELECT + INSERT + DELETE
-- =============================================
DROP POLICY "Authenticated users can read projeto anexos" ON storage.objects;
DROP POLICY "Authenticated users can upload projeto anexos" ON storage.objects;
DROP POLICY "Users can delete own projeto anexos" ON storage.objects;

CREATE POLICY "projeto_anexos_select_owned" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'projeto-anexos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin_or_supervisor(auth.uid())
  )
);

CREATE POLICY "projeto_anexos_insert_owned" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'projeto-anexos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "projeto_anexos_delete_owned" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'projeto-anexos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin_or_supervisor(auth.uid())
  )
);

-- =============================================
-- Fix 7: Storage INSERT path ownership — 5 buckets
-- =============================================

-- fabrica-revisao-docs: replace permissive INSERT
DROP POLICY "fabrica_revisao_docs_insert" ON storage.objects;
CREATE POLICY "fabrica_revisao_docs_insert_owned" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'fabrica-revisao-docs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- fabrica-revisao-docs: fix UPDATE and DELETE from public to authenticated with ownership
DROP POLICY "fabrica_revisao_docs_update" ON storage.objects;
DROP POLICY "fabrica_revisao_docs_delete" ON storage.objects;
CREATE POLICY "fabrica_revisao_docs_update_owned" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'fabrica-revisao-docs'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin_or_supervisor(auth.uid())
  )
);
CREATE POLICY "fabrica_revisao_docs_delete_owned" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'fabrica-revisao-docs'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin_or_supervisor(auth.uid())
  )
);

-- marketing-assets: replace permissive INSERT + fix DELETE/UPDATE from public
DROP POLICY "Authenticated users can upload marketing assets" ON storage.objects;
DROP POLICY "Users can delete their own marketing assets" ON storage.objects;
DROP POLICY "Users can update their own marketing assets" ON storage.objects;
CREATE POLICY "marketing_assets_insert_owned" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'marketing-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "marketing_assets_delete_owned" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'marketing-assets'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin_or_supervisor(auth.uid())
  )
);
CREATE POLICY "marketing_assets_update_owned" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'marketing-assets'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin_or_supervisor(auth.uid())
  )
);

-- campaign-evidence: remove duplicate INSERT without ownership
DROP POLICY "Authenticated users can upload campaign evidence" ON storage.objects;

-- comprovantes: add INSERT with path ownership
DROP POLICY IF EXISTS "comprovantes_insert_authenticated" ON storage.objects;
CREATE POLICY "comprovantes_insert_owned" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'comprovantes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- trade-budget-docs: replace permissive INSERT + DELETE
DROP POLICY "Usuários autenticados podem fazer upload de docs" ON storage.objects;
DROP POLICY "Usuários autenticados podem deletar seus docs" ON storage.objects;
DROP POLICY "Usuários autenticados podem ver docs de verbas" ON storage.objects;
CREATE POLICY "trade_budget_docs_insert_owned" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'trade-budget-docs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "trade_budget_docs_delete_owned" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'trade-budget-docs'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin_or_supervisor(auth.uid())
  )
);
