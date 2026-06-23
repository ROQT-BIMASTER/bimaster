-- scripts/audit/db-stats.sql
-- Audit-only. Coletado via psql na CI ou manualmente. Saída esperada: 1 row.
-- Uso:
--   psql -A -F '|' -t -f scripts/audit/db-stats.sql > docs/audit/2026-Q2/generated/DB_STATS.snapshot.csv
SELECT
  (SELECT count(*) FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS tables_public,
  (SELECT count(*) FROM information_schema.views
     WHERE table_schema = 'public') AS views_public,
  (SELECT count(*) FROM pg_tables
     WHERE schemaname = 'public' AND rowsecurity = true) AS tables_rls_enabled,
  (SELECT count(*) FROM pg_tables
     WHERE schemaname = 'public' AND rowsecurity = false) AS tables_rls_disabled,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') AS policies_public,
  (SELECT count(*) FROM information_schema.routines
     WHERE routine_schema = 'public') AS functions_public,
  (SELECT count(*) FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prosecdef = true) AS functions_security_definer,
  (SELECT count(*) FROM information_schema.triggers
     WHERE trigger_schema = 'public') AS triggers_public,
  (SELECT count(*) FROM storage.buckets) AS storage_buckets,
  (SELECT count(*) FROM storage.buckets WHERE public = true) AS storage_buckets_public,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public'
       AND cmd IN ('INSERT','UPDATE','DELETE')
       AND (qual = 'true' OR with_check = 'true')) AS policies_always_true_write;
