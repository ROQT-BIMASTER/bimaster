
-- (a) Privatize creative-studio
UPDATE storage.buckets SET public = false WHERE id = 'creative-studio';

-- (b) INSERT policies with UID prefix enforcement
-- creative-studio already has correct policy; trade-assets and email-assets need fix.
DROP POLICY IF EXISTS "Authenticated users can upload trade assets" ON storage.objects;
DROP POLICY IF EXISTS "trade_assets_insert_owner_prefix" ON storage.objects;
CREATE POLICY "trade_assets_insert_owner_prefix" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'trade-assets'
  AND (storage.foldername(name))[1] = (select auth.uid())::text
);

DROP POLICY IF EXISTS "email_assets_insert_owner_prefix" ON storage.objects;
CREATE POLICY "email_assets_insert_owner_prefix" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'email-assets'
  AND (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Note: trade-banners INSERT is admin-only (already correct, no prefix needed).
-- creative-studio INSERT already enforces uid prefix (kept as-is).

-- (c) + (d) file_size_limit and allowed_mime_types per category
-- Fiscal buckets (25 MB, PDFs/images/xml)
UPDATE storage.buckets SET
  file_size_limit = 26214400,
  allowed_mime_types = ARRAY[
    'application/pdf','image/png','image/jpeg','image/webp','image/heic',
    'application/xml','text/xml','application/octet-stream',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]
WHERE id IN (
  'china-documentos','fabrica-custo-evidencias','fabrica-cotacoes',
  'fabrica-revisao-docs','fabrica-nfe-xmls','trade-expense-docs',
  'event-expense-docs','department-expense-docs','campaign-evidence',
  'comprovantes','trade-budget-docs','china-pasta-digital','pasta-digital',
  'payment-chat-files','revisao-orcamentos','embalagem-analise','etiqueta-bula'
);

-- Heavy media (500 MB)
UPDATE storage.buckets SET
  file_size_limit = 524288000,
  allowed_mime_types = ARRAY[
    'audio/webm','audio/mpeg','audio/mp4','audio/wav','audio/ogg',
    'video/mp4','video/webm','video/quicktime',
    'image/png','image/jpeg','image/webp','image/gif'
  ]
WHERE id IN ('meeting-recordings','narracoes-roteirista','influencer-media','post-media');

-- Creative-studio (allow images for AI gen; up to 50 MB)
UPDATE storage.buckets SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp']
WHERE id = 'creative-studio';

-- Photo buckets (10 MB)
UPDATE storage.buckets SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','image/heic','image/gif']
WHERE id IN (
  'avatars','fabrica-produto-fotos','trade-photos','produto-brasil-imagens',
  'amostras','reward-banners','aprovacao-artes','fluxo-artes'
);

-- Project mixed-content buckets (50 MB)
UPDATE storage.buckets SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'application/pdf','image/png','image/jpeg','image/webp','image/gif','image/heic',
    'video/mp4','video/quicktime','video/webm',
    'application/octet-stream','application/postscript',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'text/plain','text/csv'
  ]
WHERE id IN (
  'projeto-anexos','projeto-documentos','projeto-relatorios','process-attachments',
  'documento-anexos','attachments','marketing-assets'
);

-- Email + banner (5 MB, images only)
UPDATE storage.buckets SET
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp']
WHERE id IN ('email-assets','trade-assets','trade-banners');
