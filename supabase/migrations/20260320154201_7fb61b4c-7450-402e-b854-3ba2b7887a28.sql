
ALTER TABLE fabrica_fornecedores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fabrica_fornecedores' AND policyname='Authenticated full access') THEN
    CREATE POLICY "Authenticated full access" ON fabrica_fornecedores FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;
