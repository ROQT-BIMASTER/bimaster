
-- 1. trade-photos: DROP conflicting SELECT policy
DROP POLICY IF EXISTS "Usuários trade podem ver fotos" ON storage.objects;

-- 2. post-media: Add path ownership to SELECT
DROP POLICY IF EXISTS "Authenticated users can view post media" ON storage.objects;
CREATE POLICY "post_media_select_owned"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'post-media'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor'))
  )
);

-- post-media: Add path ownership to UPDATE
DROP POLICY IF EXISTS "Authenticated users can update post media" ON storage.objects;
CREATE POLICY "post_media_update_owned"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'post-media'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor'))
  )
);

-- 3. configuracoes_cobranca: Restrict DELETE to admin only
DROP POLICY IF EXISTS "Supervisors and admins can delete billing configs" ON public.configuracoes_cobranca;
DROP POLICY IF EXISTS "configuracoes_cobranca_delete" ON public.configuracoes_cobranca;
CREATE POLICY "configuracoes_cobranca_delete_admin_only"
ON public.configuracoes_cobranca FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
