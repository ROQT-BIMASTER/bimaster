-- Privatize trade-banners bucket
--
-- Contexto: este era o único dos 12 buckets listados no brief que ainda
-- permanecia public=true (os demais já foram privatizados em PRs anteriores).
-- A URL pública /storage/v1/object/public/trade-banners/* expunha banners,
-- displays e materiais de incentivos sem autenticação.
--
-- Esta migration:
--   1. Marca o bucket como privado.
--   2. Adiciona policies de SELECT (necessária para createSignedUrl) e
--      INSERT/UPDATE para authenticated. DELETE já existia (admin-only).
--   3. NÃO migra os 22 registros existentes em trade_banners.imagem_url /
--      trade_displays / trade_incentivos — eles guardam URL pública completa
--      e vão deixar de carregar até re-upload. Decidido aceitar como dívida
--      curta (admin re-sobe os banners). Frontend novo grava signed URL de
--      1 ano em vez de URL pública.

UPDATE storage.buckets SET public = false WHERE id = 'trade-banners';

-- SELECT: qualquer authenticated pode emitir signed URL (banners são
-- conteúdo institucional, não há tenant isolation no bucket).
DROP POLICY IF EXISTS "Authenticated can read trade banners" ON storage.objects;
CREATE POLICY "Authenticated can read trade banners"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'trade-banners');

-- INSERT: admins gerenciam banners; deixar authenticated por enquanto para
-- não quebrar o fluxo atual (uploads vêm de telas admin-only por roteamento).
DROP POLICY IF EXISTS "Authenticated can upload trade banners" ON storage.objects;
CREATE POLICY "Authenticated can upload trade banners"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'trade-banners');

-- UPDATE: necessário para upsert / replace de arte.
DROP POLICY IF EXISTS "Authenticated can update trade banners" ON storage.objects;
CREATE POLICY "Authenticated can update trade banners"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'trade-banners')
  WITH CHECK (bucket_id = 'trade-banners');