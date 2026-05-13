
DROP POLICY IF EXISTS "fabrica_fotos_select_scoped" ON storage.objects;
DROP POLICY IF EXISTS "fabrica_fotos_insert_module" ON storage.objects;
DROP POLICY IF EXISTS "fabrica_fotos_update_module" ON storage.objects;
DROP POLICY IF EXISTS "fabrica_fotos_delete_module" ON storage.objects;

CREATE POLICY "fabrica_fotos_select_authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'fabrica-produto-fotos');

CREATE POLICY "fabrica_fotos_insert_authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'fabrica-produto-fotos');

CREATE POLICY "fabrica_fotos_update_authenticated"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'fabrica-produto-fotos')
WITH CHECK (bucket_id = 'fabrica-produto-fotos');

CREATE POLICY "fabrica_fotos_delete_authenticated"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'fabrica-produto-fotos');
