
-- 1) aprovacao-artes: drop broad insert
DROP POLICY IF EXISTS "Authenticated can upload aprovacao files" ON storage.objects;

-- 2) projeto-documentos: drop broad insert
DROP POLICY IF EXISTS "Auth users upload projeto docs" ON storage.objects;

-- 3) fabrica-cotacoes: replace broad insert/delete
DROP POLICY IF EXISTS "Usuarios autenticados upload cotacoes" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados delete cotacoes" ON storage.objects;

CREATE POLICY "fabrica_cotacoes_insert_owner"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'fabrica-cotacoes'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR is_admin_or_supervisor(auth.uid())
    )
  );

CREATE POLICY "fabrica_cotacoes_delete_owner"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'fabrica-cotacoes'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR is_admin_or_supervisor(auth.uid())
    )
  );

-- 4) fabrica-produto-fotos: enforce module access on all ops
DROP POLICY IF EXISTS "fabrica_fotos_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "fabrica_fotos_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "fabrica_fotos_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "fabrica_fotos_delete_authenticated" ON storage.objects;

CREATE POLICY "fabrica_fotos_select_module"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'fabrica-produto-fotos'
    AND usuario_tem_permissao_modulo(auth.uid(), 'fabrica')
  );

CREATE POLICY "fabrica_fotos_insert_module"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'fabrica-produto-fotos'
    AND usuario_tem_permissao_modulo(auth.uid(), 'fabrica')
  );

CREATE POLICY "fabrica_fotos_update_module"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'fabrica-produto-fotos'
    AND usuario_tem_permissao_modulo(auth.uid(), 'fabrica')
  )
  WITH CHECK (
    bucket_id = 'fabrica-produto-fotos'
    AND usuario_tem_permissao_modulo(auth.uid(), 'fabrica')
  );

CREATE POLICY "fabrica_fotos_delete_module"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'fabrica-produto-fotos'
    AND (
      usuario_tem_permissao_modulo(auth.uid(), 'fabrica')
      AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR is_admin_or_supervisor(auth.uid())
      )
    )
  );
