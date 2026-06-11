-- Align china-documentos storage policies with china_produto_documentos RLS:
-- every user with the 'china' module (or 'fabrica') must be able to upload,
-- read and remove documents on submissões they have legitimate access to.
-- Mirrors policies already in place on the metadata table.

DROP POLICY IF EXISTS china_storage_insert_owned ON storage.objects;
DROP POLICY IF EXISTS china_storage_select ON storage.objects;
DROP POLICY IF EXISTS china_storage_delete ON storage.objects;

CREATE POLICY china_storage_insert_owned
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'china-documentos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR is_admin_or_supervisor(auth.uid())
    OR check_user_access(auth.uid(), 'fabrica')
    OR check_user_access(auth.uid(), 'china')
    OR EXISTS (
      SELECT 1 FROM public.china_produto_submissoes s
      WHERE (s.id)::text = (storage.foldername(objects.name))[1]
        AND s.created_by = auth.uid()
    )
  )
);

CREATE POLICY china_storage_select
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'china-documentos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR is_admin_or_supervisor(auth.uid())
    OR check_user_access(auth.uid(), 'fabrica')
    OR check_user_access(auth.uid(), 'china')
    OR EXISTS (
      SELECT 1 FROM public.china_produto_submissoes s
      WHERE (s.id)::text = (storage.foldername(objects.name))[1]
        AND s.created_by = auth.uid()
    )
  )
);

CREATE POLICY china_storage_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'china-documentos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR is_admin_or_supervisor(auth.uid())
    OR check_user_access(auth.uid(), 'fabrica')
    OR check_user_access(auth.uid(), 'china')
    OR EXISTS (
      SELECT 1 FROM public.china_produto_submissoes s
      WHERE (s.id)::text = (storage.foldername(objects.name))[1]
        AND s.created_by = auth.uid()
    )
  )
);