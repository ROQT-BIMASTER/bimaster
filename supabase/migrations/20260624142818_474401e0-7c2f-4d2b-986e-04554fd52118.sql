-- SELECT: autenticados podem ver fotos oficiais
CREATE POLICY "china_foto_oficial_select_authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'china-submissao-foto-oficial');

-- INSERT: usuário só envia em path que comece com seu UID
CREATE POLICY "china_foto_oficial_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'china-submissao-foto-oficial'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- UPDATE: idem
CREATE POLICY "china_foto_oficial_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'china-submissao-foto-oficial'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'china-submissao-foto-oficial'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE: idem
CREATE POLICY "china_foto_oficial_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'china-submissao-foto-oficial'
  AND (storage.foldername(name))[1] = auth.uid()::text
);