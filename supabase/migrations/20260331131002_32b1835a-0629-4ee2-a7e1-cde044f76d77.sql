
-- Fix remaining security findings

-- 1. fabrica-cotacoes: remove anonymous SELECT, add authenticated-only with module check
DROP POLICY IF EXISTS "Cotacoes arquivos publicos leitura" ON storage.objects;
CREATE POLICY "fabrica_cotacoes_select_auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'fabrica-cotacoes' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR is_admin_or_supervisor(auth.uid())
    OR usuario_tem_permissao_modulo(auth.uid(), 'fabrica')
  ));

-- 2. aprovacao-artes: remove anonymous SELECT
DROP POLICY IF EXISTS "Anyone can view aprovacao files" ON storage.objects;
CREATE POLICY "aprovacao_artes_select_auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'aprovacao-artes' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR is_admin_or_supervisor(auth.uid())
  ));

-- 3. Additional buckets missing ownership — amostras, embalagem-analise, etiqueta-bula, fluxo-artes, marketing-assets, produto-brasil-imagens
DROP POLICY IF EXISTS "Auth users read amostras" ON storage.objects;
CREATE POLICY "amostras_select_owned" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'amostras' AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin_or_supervisor(auth.uid())));

DROP POLICY IF EXISTS "Auth users read embalagem-analise" ON storage.objects;
CREATE POLICY "embalagem_analise_select_owned" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'embalagem-analise' AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin_or_supervisor(auth.uid())));

DROP POLICY IF EXISTS "Auth users read etiqueta-bula" ON storage.objects;
CREATE POLICY "etiqueta_bula_select_owned" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'etiqueta-bula' AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin_or_supervisor(auth.uid())));

DROP POLICY IF EXISTS "Auth users can read fluxo-artes" ON storage.objects;
CREATE POLICY "fluxo_artes_select_owned" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'fluxo-artes' AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin_or_supervisor(auth.uid())));

DROP POLICY IF EXISTS "Auth users can read marketing-assets" ON storage.objects;
CREATE POLICY "marketing_assets_select_owned" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'marketing-assets' AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin_or_supervisor(auth.uid())));

DROP POLICY IF EXISTS "Auth users can read produto-brasil-imagens" ON storage.objects;
CREATE POLICY "produto_brasil_imagens_select_owned" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'produto-brasil-imagens' AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin_or_supervisor(auth.uid())));

-- 4. payment-chat-files INSERT: add folder ownership check
DROP POLICY IF EXISTS "Authenticated users can upload payment chat files" ON storage.objects;
CREATE POLICY "payment_chat_files_insert_owned" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-chat-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 5. china-documentos INSERT: add folder ownership check  
DROP POLICY IF EXISTS "china_storage_insert" ON storage.objects;
CREATE POLICY "china_storage_insert_owned" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'china-documentos' AND (storage.foldername(name))[1] = auth.uid()::text);
