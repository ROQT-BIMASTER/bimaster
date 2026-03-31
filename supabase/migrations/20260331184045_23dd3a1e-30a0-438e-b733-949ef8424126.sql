
-- =====================================================
-- FIX 1: trade-photos — remove permissive UPDATE/DELETE without ownership
-- =====================================================
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias fotos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem deletar suas próprias fotos" ON storage.objects;
-- Also remove duplicate DELETE policy (identical to "Admins podem deletar fotos trade")
DROP POLICY IF EXISTS "Admins podem deletar fotos" ON storage.objects;

-- =====================================================
-- FIX 2: vendor_availability — remove public SELECT
-- =====================================================
DROP POLICY IF EXISTS "Todos podem ver disponibilidade" ON public.vendor_availability;

-- =====================================================
-- FIX 3: dynamic_form_attachments — restrict anon access
-- =====================================================
DROP POLICY IF EXISTS "Anyone can read attachments" ON public.dynamic_form_attachments;

CREATE POLICY "Authenticated can read attachments"
  ON public.dynamic_form_attachments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Anon read active form attachments"
  ON public.dynamic_form_attachments FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.dynamic_forms f
    WHERE f.id = dynamic_form_attachments.form_id
    AND f.status = 'active'
  ));

-- =====================================================
-- FIX 4: Remove duplicate INSERT policies without path ownership
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can upload department-expense-docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload event-expense-docs" ON storage.objects;
-- Correct policies with path ownership already exist:
-- "Auth users upload department-expense-docs own path"
-- "Auth users upload own event-expense-docs"

-- =====================================================
-- FIX 5: Remove duplicate DELETE policies without ownership
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can delete trade docs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own trade assets" ON storage.objects;

-- Recreate with ownership check
CREATE POLICY "Users can delete own trade docs"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'trade-expense-docs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR is_admin_or_supervisor(auth.uid())
    )
  );

CREATE POLICY "Users can delete own trade assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'trade-assets'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR is_admin_or_supervisor(auth.uid())
    )
  );
