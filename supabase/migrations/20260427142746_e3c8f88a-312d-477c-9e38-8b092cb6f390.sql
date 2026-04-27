-- Relaxar políticas do bucket fabrica-produto-fotos para qualquer usuário autenticado.
-- Motivo: usuários de outras hierarquias estavam bloqueados ao subir fotos durante o
-- cadastro de produtos acabados. Fotos não são dado sensível e são servidas via Signed URL.

DROP POLICY IF EXISTS fabrica_fotos_insert ON storage.objects;
DROP POLICY IF EXISTS fabrica_fotos_update ON storage.objects;
DROP POLICY IF EXISTS fabrica_fotos_delete ON storage.objects;
DROP POLICY IF EXISTS fabrica_fotos_select ON storage.objects;

CREATE POLICY fabrica_fotos_select
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'fabrica-produto-fotos');

CREATE POLICY fabrica_fotos_insert
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'fabrica-produto-fotos');

CREATE POLICY fabrica_fotos_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'fabrica-produto-fotos')
  WITH CHECK (bucket_id = 'fabrica-produto-fotos');

CREATE POLICY fabrica_fotos_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'fabrica-produto-fotos');