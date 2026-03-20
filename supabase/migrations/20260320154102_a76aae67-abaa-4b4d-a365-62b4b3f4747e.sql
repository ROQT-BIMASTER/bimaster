
-- Enable RLS
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_chart_of_accounts ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated full access
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='empresas' AND policyname='Authenticated full access') THEN
    CREATE POLICY "Authenticated full access" ON empresas FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contas_pagar' AND policyname='Authenticated full access') THEN
    CREATE POLICY "Authenticated full access" ON contas_pagar FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trade_chart_of_accounts' AND policyname='Authenticated full access') THEN
    CREATE POLICY "Authenticated full access" ON trade_chart_of_accounts FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;
