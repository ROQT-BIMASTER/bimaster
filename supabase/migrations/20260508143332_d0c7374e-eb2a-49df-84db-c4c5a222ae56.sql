
-- 1. cofre-generico: restringir SELECT a admins
DROP POLICY IF EXISTS "cofre_generico_select" ON storage.objects;
CREATE POLICY "cofre_generico_admin_select"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'cofre-generico' AND has_role(auth.uid(), 'admin'::app_role));

-- 2. dynamic-form-uploads: remover acesso anônimo, exigir autenticação + path ownership
DROP POLICY IF EXISTS "Anyone can read form attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload form attachments" ON storage.objects;

CREATE POLICY "Authenticated can read own form attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'dynamic-form-uploads'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR is_admin_or_supervisor(auth.uid())
  )
);

CREATE POLICY "Authenticated can upload own form attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'dynamic-form-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. campaign-evidence: remover policy permissiva sem ownership
DROP POLICY IF EXISTS "campaign_evidence_insert" ON storage.objects;
-- (a policy "Users can upload own campaign-evidence files" já cobre INSERT com ownership)

-- 4. trade-assets: tornar privado e adicionar SELECT autenticado
UPDATE storage.buckets SET public = false WHERE id = 'trade-assets';

DROP POLICY IF EXISTS "Public can read trade assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read trade assets" ON storage.objects;

CREATE POLICY "Authenticated can read trade assets"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'trade-assets');

-- Corrigir UPDATE de trade-assets que estava sem ownership
DROP POLICY IF EXISTS "Users can update own trade assets" ON storage.objects;
CREATE POLICY "Users can update own trade assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'trade-assets'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR is_admin_or_supervisor(auth.uid())
  )
);
