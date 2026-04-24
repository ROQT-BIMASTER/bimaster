-- Ajusta políticas do bucket fabrica-produto-fotos para liberar quem tem acesso ao módulo "fabrica"
DROP POLICY IF EXISTS fabrica_fotos_insert ON storage.objects;
DROP POLICY IF EXISTS fabrica_fotos_update ON storage.objects;
DROP POLICY IF EXISTS fabrica_fotos_delete ON storage.objects;

CREATE POLICY fabrica_fotos_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'fabrica-produto-fotos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR is_admin_or_supervisor(auth.uid())
    OR check_user_access(auth.uid(), 'fabrica')
  )
);

CREATE POLICY fabrica_fotos_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'fabrica-produto-fotos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR is_admin_or_supervisor(auth.uid())
    OR check_user_access(auth.uid(), 'fabrica')
  )
);

CREATE POLICY fabrica_fotos_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'fabrica-produto-fotos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR is_admin_or_supervisor(auth.uid())
    OR check_user_access(auth.uid(), 'fabrica')
  )
);