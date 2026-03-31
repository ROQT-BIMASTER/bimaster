
-- ============================================================
-- FASE 2: STORAGE PATH OWNERSHIP
-- ============================================================

-- 1. trade-photos INSERT — adicionar path ownership
DROP POLICY IF EXISTS "Users can upload trade photos" ON storage.objects;
CREATE POLICY "Users can upload trade photos with path ownership"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'trade-photos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin_or_supervisor(auth.uid())
    )
  );

-- 2. fabrica-produto-fotos — adicionar path ownership a todas as operações
DROP POLICY IF EXISTS "Authenticated users can upload product photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product photos" ON storage.objects;
DROP POLICY IF EXISTS "fabrica_fotos_select_authenticated" ON storage.objects;

CREATE POLICY "fabrica_fotos_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'fabrica-produto-fotos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.check_user_access(auth.uid(), 'fabrica')
    )
  );

CREATE POLICY "fabrica_fotos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fabrica-produto-fotos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin_or_supervisor(auth.uid())
    )
  );

CREATE POLICY "fabrica_fotos_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'fabrica-produto-fotos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin_or_supervisor(auth.uid())
    )
  );

CREATE POLICY "fabrica_fotos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'fabrica-produto-fotos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin_or_supervisor(auth.uid())
    )
  );
