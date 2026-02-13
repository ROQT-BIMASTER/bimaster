-- =============================================
-- FASE: Tornar buckets sensíveis PRIVADOS
-- Sem impacto aos usuários - o código já usa resolveStorageUrl
-- que gera signed URLs automaticamente
-- =============================================

-- 1. Tornar buckets privados (documentos sensíveis)
UPDATE storage.buckets SET public = false WHERE id = 'attachments';
UPDATE storage.buckets SET public = false WHERE id = 'campaign-evidence';
UPDATE storage.buckets SET public = false WHERE id = 'department-expense-docs';
UPDATE storage.buckets SET public = false WHERE id = 'event-expense-docs';
UPDATE storage.buckets SET public = false WHERE id = 'fabrica-cotacoes';
UPDATE storage.buckets SET public = false WHERE id = 'fabrica-custo-evidencias';
UPDATE storage.buckets SET public = false WHERE id = 'trade-budget-docs';
UPDATE storage.buckets SET public = false WHERE id = 'trade-expense-docs';

-- 2. Garantir que buckets privados tenham política de SELECT autenticado
-- (para que createSignedUrl funcione)

-- attachments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Auth users can read attachments'
  ) THEN
    CREATE POLICY "Auth users can read attachments"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'attachments');
  END IF;
END $$;

-- campaign-evidence
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Auth users can read campaign-evidence'
  ) THEN
    CREATE POLICY "Auth users can read campaign-evidence"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'campaign-evidence');
  END IF;
END $$;

-- department-expense-docs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Auth users can read department-expense-docs'
  ) THEN
    CREATE POLICY "Auth users can read department-expense-docs"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'department-expense-docs');
  END IF;
END $$;

-- event-expense-docs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Auth users can read event-expense-docs'
  ) THEN
    CREATE POLICY "Auth users can read event-expense-docs"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'event-expense-docs');
  END IF;
END $$;

-- fabrica-cotacoes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Auth users can read fabrica-cotacoes'
  ) THEN
    CREATE POLICY "Auth users can read fabrica-cotacoes"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'fabrica-cotacoes');
  END IF;
END $$;

-- fabrica-custo-evidencias
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Auth users can read fabrica-custo-evidencias'
  ) THEN
    CREATE POLICY "Auth users can read fabrica-custo-evidencias"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'fabrica-custo-evidencias');
  END IF;
END $$;

-- trade-budget-docs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Auth users can read trade-budget-docs'
  ) THEN
    CREATE POLICY "Auth users can read trade-budget-docs"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'trade-budget-docs');
  END IF;
END $$;

-- trade-expense-docs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Auth users can read trade-expense-docs'
  ) THEN
    CREATE POLICY "Auth users can read trade-expense-docs"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'trade-expense-docs');
  END IF;
END $$;