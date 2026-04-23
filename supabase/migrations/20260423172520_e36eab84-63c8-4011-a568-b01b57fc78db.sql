-- Hardening do bucket 'pasta-digital'.
-- Path: <produto_brasil_id|china_produto_submissao_id>/<fase>/<file>

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (qual ILIKE '%pasta-digital%' OR with_check ILIKE '%pasta-digital%')
      AND policyname NOT ILIKE '%v2%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "pasta-digital read v2"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'pasta-digital'
  AND (
    is_admin_or_supervisor(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.produto_brasil_pasta_digital pd
      WHERE pd.arquivo_path = storage.objects.name
    )
    OR EXISTS (
      SELECT 1 FROM public.china_pasta_digital cpd
      WHERE cpd.arquivo_path = storage.objects.name
    )
  )
);

CREATE POLICY "pasta-digital write v2"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pasta-digital'
  AND owner = auth.uid()
  AND (
    is_admin_or_supervisor(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.produtos_brasil pb
      WHERE pb.id::text = (storage.foldername(name))[1]
    )
    OR EXISTS (
      SELECT 1 FROM public.china_produto_submissoes cs
      WHERE cs.id::text = (storage.foldername(name))[1]
    )
  )
);

CREATE POLICY "pasta-digital update v2"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'pasta-digital'
  AND (owner = auth.uid() OR is_admin_or_supervisor(auth.uid()))
);

CREATE POLICY "pasta-digital delete v2"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'pasta-digital'
  AND (owner = auth.uid() OR is_admin_or_supervisor(auth.uid()))
);