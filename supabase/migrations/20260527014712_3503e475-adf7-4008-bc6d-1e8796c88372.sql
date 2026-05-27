-- DB Performance Fase 2B (1/9) — Vendas (Union)
-- Substitui auth.uid() por (select auth.uid()) nas policies da tabela Union
-- para que o Postgres avalie a função uma vez por query (initPlan) em vez de
-- uma vez por linha. Preserva roles, cmd, permissive, qual e with_check via
-- metadados de pg_policies.

DO $$
DECLARE
  r record;
  new_qual text;
  new_check text;
  sql text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'Union'
      AND (qual LIKE '%auth.uid()%' OR with_check LIKE '%auth.uid()%')
      AND COALESCE(qual,'')       NOT LIKE '%select auth.uid()%'
      AND COALESCE(with_check,'') NOT LIKE '%select auth.uid()%'
  LOOP
    new_qual  := regexp_replace(r.qual,       '(?<!\(select )auth\.uid\(\)', '(select auth.uid())', 'g');
    new_check := regexp_replace(r.with_check, '(?<!\(select )auth\.uid\(\)', '(select auth.uid())', 'g');

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', r.policyname, r.schemaname, r.tablename);

    sql := format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
      r.policyname, r.schemaname, r.tablename,
      r.permissive, r.cmd,
      array_to_string(r.roles, ', ')
    );
    IF new_qual  IS NOT NULL THEN sql := sql || format(' USING (%s)', new_qual); END IF;
    IF new_check IS NOT NULL THEN sql := sql || format(' WITH CHECK (%s)', new_check); END IF;

    EXECUTE sql || ';';
    RAISE NOTICE 'Reescrita: %.% policy %', r.schemaname, r.tablename, r.policyname;
  END LOOP;
END $$;