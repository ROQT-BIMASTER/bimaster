-- Cleanup das policies da tabela Union que ficaram com (SELECT (SELECT auth.uid() AS uid) AS uid)
-- após a migration anterior. Colapsa o aninhamento de volta para (select auth.uid()).
-- Semanticamente equivalente, apenas mais limpo.

DO $$
DECLARE
  r record;
  new_qual text;
  new_check text;
  sql text;
  pattern text := '\(\s*SELECT\s+\(\s*SELECT\s+auth\.uid\(\)\s+AS\s+uid\s*\)\s+AS\s+uid\s*\)';
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'Union'
      AND ( qual ~ pattern OR with_check ~ pattern )
  LOOP
    new_qual  := regexp_replace(r.qual,       pattern, '(select auth.uid())', 'gi');
    new_check := regexp_replace(r.with_check, pattern, '(select auth.uid())', 'gi');

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
    RAISE NOTICE 'Cleanup: %.% policy %', r.schemaname, r.tablename, r.policyname;
  END LOOP;
END $$;