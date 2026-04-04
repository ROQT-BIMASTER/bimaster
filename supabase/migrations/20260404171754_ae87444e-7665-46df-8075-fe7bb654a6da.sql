
-- ============================================================================
-- FIX 1: Storage fabrica-nfe-xmls — restringir a módulo fábrica/admin
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can read NF-e XMLs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload NF-e XMLs" ON storage.objects;
DROP POLICY IF EXISTS "Fabrica users can read NF-e XMLs" ON storage.objects;
DROP POLICY IF EXISTS "Fabrica users can upload NF-e XMLs" ON storage.objects;

CREATE POLICY "Fabrica users can read NF-e XMLs" ON storage.objects
FOR SELECT USING (
  bucket_id = 'fabrica-nfe-xmls' AND (
    is_admin_or_supervisor(auth.uid())
    OR EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE upm.usuario_id = auth.uid()
        AND ms.codigo = 'fabrica'
    )
  )
);

CREATE POLICY "Fabrica users can upload NF-e XMLs" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'fabrica-nfe-xmls' AND (
    is_admin_or_supervisor(auth.uid())
    OR EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE upm.usuario_id = auth.uid()
        AND ms.codigo = 'fabrica'
    )
  )
);

-- ============================================================================
-- FIX 2: Storage DELETE — ownership check em 3 buckets
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can delete amostras files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete embalagem-analise files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete etiqueta-bula files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own amostras files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own embalagem-analise files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own etiqueta-bula files" ON storage.objects;

CREATE POLICY "Users can delete own amostras files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'amostras' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR is_admin_or_supervisor(auth.uid())
  )
);

CREATE POLICY "Users can delete own embalagem-analise files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'embalagem-analise' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR is_admin_or_supervisor(auth.uid())
  )
);

CREATE POLICY "Users can delete own etiqueta-bula files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'etiqueta-bula' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR is_admin_or_supervisor(auth.uid())
  )
);

-- ============================================================================
-- FIX 3: Storage INSERT — path ownership em 7 buckets
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can upload campaign evidence" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own campaign-evidence files" ON storage.objects;
CREATE POLICY "Users can upload own campaign-evidence files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'campaign-evidence' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR is_admin_or_supervisor(auth.uid())
  )
);

DROP POLICY IF EXISTS "Authenticated users can upload amostras files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own amostras files" ON storage.objects;
CREATE POLICY "Users can upload own amostras files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'amostras' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR is_admin_or_supervisor(auth.uid())
  )
);

DROP POLICY IF EXISTS "Authenticated users can upload embalagem-analise files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own embalagem-analise files" ON storage.objects;
CREATE POLICY "Users can upload own embalagem-analise files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'embalagem-analise' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR is_admin_or_supervisor(auth.uid())
  )
);

DROP POLICY IF EXISTS "Authenticated users can upload etiqueta-bula files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own etiqueta-bula files" ON storage.objects;
CREATE POLICY "Users can upload own etiqueta-bula files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'etiqueta-bula' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR is_admin_or_supervisor(auth.uid())
  )
);

DROP POLICY IF EXISTS "Authenticated users can upload fluxo-artes files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own fluxo-artes files" ON storage.objects;
CREATE POLICY "Users can upload own fluxo-artes files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'fluxo-artes' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR is_admin_or_supervisor(auth.uid())
  )
);

DROP POLICY IF EXISTS "Authenticated users can upload aprovacao-artes files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own aprovacao-artes files" ON storage.objects;
CREATE POLICY "Users can upload own aprovacao-artes files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'aprovacao-artes' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR is_admin_or_supervisor(auth.uid())
  )
);

DROP POLICY IF EXISTS "Authenticated users can upload fabrica-custo-evidencias files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own fabrica-custo-evidencias files" ON storage.objects;
CREATE POLICY "Users can upload own fabrica-custo-evidencias files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'fabrica-custo-evidencias' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR is_admin_or_supervisor(auth.uid())
  )
);

-- ============================================================================
-- FIX 4: configuracoes_cobranca — restringir INSERT/UPDATE a admin only
-- ============================================================================

DROP POLICY IF EXISTS "admins_insert_cobranca" ON configuracoes_cobranca;
DROP POLICY IF EXISTS "admins_update_cobranca" ON configuracoes_cobranca;

CREATE POLICY "admins_insert_cobranca" ON configuracoes_cobranca
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin')
);

CREATE POLICY "admins_update_cobranca" ON configuracoes_cobranca
FOR UPDATE USING (
  has_role(auth.uid(), 'admin')
);

-- ============================================================================
-- FIX 5: usuario_permissoes_modulos — DROP SELECT USING(true)
-- ============================================================================

DROP POLICY IF EXISTS "Acesso total permissoes_modulos - SELECT" ON usuario_permissoes_modulos;
