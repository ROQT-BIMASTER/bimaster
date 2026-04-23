-- Tighten access to the private "pasta-digital" bucket.
--
-- Path layout: "<produto_brasil_id>/<fase>/<timestamp>_<filename>"
--   so (storage.foldername(name))[1] == produto_brasil_id (NOT auth.uid()).
--
-- Authorization model (matches the pre-existing scoped policy on the
-- metadata table produto_brasil_pasta_digital):
--   - Owner of the metadata row (created_by = auth.uid())
--   - Admin / supervisor (has_role)
--
-- For INSERT we require an authenticated user AND the path's first segment
-- to be a valid produto_brasil_id, so a malicious client cannot drop files
-- under arbitrary folders just to claim them later.

-- Drop the four broad policies flagged by the security scan.
DROP POLICY IF EXISTS "Auth users can view pasta digital files"   ON storage.objects;
DROP POLICY IF EXISTS "Auth users can update pasta digital files" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete pasta digital files" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can upload pasta digital files" ON storage.objects;

-- SELECT: only the metadata owner or admin/supervisor.
CREATE POLICY "pasta_digital_owner_or_admin_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'pasta-digital'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'supervisor'::app_role)
      OR EXISTS (
        SELECT 1
        FROM public.produto_brasil_pasta_digital pd
        WHERE pd.arquivo_path = storage.objects.name
          AND pd.created_by  = auth.uid()
      )
    )
  );

-- UPDATE: same scope (metadata owner or admin/supervisor).
CREATE POLICY "pasta_digital_owner_or_admin_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'pasta-digital'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'supervisor'::app_role)
      OR EXISTS (
        SELECT 1
        FROM public.produto_brasil_pasta_digital pd
        WHERE pd.arquivo_path = storage.objects.name
          AND pd.created_by  = auth.uid()
      )
    )
  );

-- DELETE: same scope.
CREATE POLICY "pasta_digital_owner_or_admin_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'pasta-digital'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'supervisor'::app_role)
      OR EXISTS (
        SELECT 1
        FROM public.produto_brasil_pasta_digital pd
        WHERE pd.arquivo_path = storage.objects.name
          AND pd.created_by  = auth.uid()
      )
    )
  );

-- INSERT: any authenticated user, BUT only into a folder whose first segment
-- is a real produto_brasil id. The metadata row (with created_by = auth.uid)
-- is written by the application immediately after the upload and is what
-- gates subsequent SELECT/UPDATE/DELETE access.
CREATE POLICY "pasta_digital_authenticated_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'pasta-digital'
    AND EXISTS (
      SELECT 1
      FROM public.produtos_brasil pb
      WHERE pb.id::text = (storage.foldername(storage.objects.name))[1]
    )
  );