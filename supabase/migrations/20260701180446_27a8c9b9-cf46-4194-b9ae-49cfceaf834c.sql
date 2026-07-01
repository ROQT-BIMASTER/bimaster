
-- Drop the broad policies that only check bucket_id
DROP POLICY IF EXISTS "Authenticated users can delete from fluxo-artes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own cost evidence files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete produto images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete revisao orcamentos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read revisao orcamentos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update trade docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload cost evidence files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload post media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload produto images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload revisao orcamentos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to fluxo-artes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload trade docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view cost evidence files" ON storage.objects;

-- fabrica-custo-evidencias: only owner or admin/supervisor
CREATE POLICY fabrica_custo_evidencias_select_scoped
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'fabrica-custo-evidencias'
    AND ((storage.foldername(name))[1] = (auth.uid())::text
         OR public.is_admin_or_supervisor(auth.uid()))
  );
CREATE POLICY fabrica_custo_evidencias_delete_owned
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'fabrica-custo-evidencias'
    AND ((storage.foldername(name))[1] = (auth.uid())::text
         OR public.is_admin_or_supervisor(auth.uid()))
  );

-- fluxo-artes: only owner or admin/supervisor
CREATE POLICY fluxo_artes_delete_owned
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'fluxo-artes'
    AND ((storage.foldername(name))[1] = (auth.uid())::text
         OR public.is_admin_or_supervisor(auth.uid()))
  );

-- produto-brasil-imagens: only owner or admin/supervisor
CREATE POLICY produto_brasil_imagens_insert_owned
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'produto-brasil-imagens'
    AND ((storage.foldername(name))[1] = (auth.uid())::text
         OR public.is_admin_or_supervisor(auth.uid()))
  );
CREATE POLICY produto_brasil_imagens_delete_owned
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'produto-brasil-imagens'
    AND ((storage.foldername(name))[1] = (auth.uid())::text
         OR public.is_admin_or_supervisor(auth.uid()))
  );

-- post-media: INSERT scoped to owner (SELECT/UPDATE already scoped)
CREATE POLICY post_media_insert_owned
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'post-media'
    AND ((storage.foldername(name))[1] = (auth.uid())::text
         OR EXISTS (
           SELECT 1 FROM public.user_roles
           WHERE user_id = auth.uid()
             AND role = ANY (ARRAY['admin'::app_role, 'supervisor'::app_role])
         ))
  );

-- trade-expense-docs: INSERT + UPDATE scoped (SELECT + DELETE already scoped)
CREATE POLICY trade_expense_docs_insert_owned
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'trade-expense-docs'
    AND ((storage.foldername(name))[1] = (auth.uid())::text
         OR public.is_admin_or_supervisor(auth.uid()))
  );
CREATE POLICY trade_expense_docs_update_owned
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'trade-expense-docs'
    AND ((storage.foldername(name))[1] = (auth.uid())::text
         OR public.is_admin_or_supervisor(auth.uid()))
  )
  WITH CHECK (
    bucket_id = 'trade-expense-docs'
    AND ((storage.foldername(name))[1] = (auth.uid())::text
         OR public.is_admin_or_supervisor(auth.uid()))
  );

-- revisao-orcamentos: scope all CRUD to owner or admin/supervisor
CREATE POLICY revisao_orcamentos_select_scoped
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'revisao-orcamentos'
    AND ((storage.foldername(name))[1] = (auth.uid())::text
         OR public.is_admin_or_supervisor(auth.uid()))
  );
CREATE POLICY revisao_orcamentos_insert_owned
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'revisao-orcamentos'
    AND ((storage.foldername(name))[1] = (auth.uid())::text
         OR public.is_admin_or_supervisor(auth.uid()))
  );
CREATE POLICY revisao_orcamentos_delete_owned
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'revisao-orcamentos'
    AND ((storage.foldername(name))[1] = (auth.uid())::text
         OR public.is_admin_or_supervisor(auth.uid()))
  );
