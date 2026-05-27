DO $migration$
DECLARE
  r RECORD; v_qual text; v_check text; v_roles_csv text;
  v_using text; v_with text; v_perm text;
  v_count int := 0; v_pending int;
  v_filter text := '^(trade|pdv|loja|vendedor|venda|union|sales|cnpj|territor)';
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname='public' AND tablename ~* v_filter
      AND (regexp_replace(COALESCE(qual,''),'\(\s*SELECT\s+auth\.(uid|jwt|role)\(\)[^)]*\)','','gi') ~* 'auth\.(uid|jwt|role)\(\)'
        OR regexp_replace(COALESCE(with_check,''),'\(\s*SELECT\s+auth\.(uid|jwt|role)\(\)[^)]*\)','','gi') ~* 'auth\.(uid|jwt|role)\(\)')
  LOOP
    v_qual := r.qual; v_check := r.with_check;
    IF v_qual IS NOT NULL THEN
      v_qual := regexp_replace(v_qual,'\(\s*SELECT\s+auth\.uid\(\)[^)]*\)','__S_UID__','gi');
      v_qual := regexp_replace(v_qual,'\(\s*SELECT\s+auth\.jwt\(\)[^)]*\)','__S_JWT__','gi');
      v_qual := regexp_replace(v_qual,'\(\s*SELECT\s+auth\.role\(\)[^)]*\)','__S_ROL__','gi');
      v_qual := regexp_replace(v_qual,'auth\.uid\(\)','(select auth.uid())','g');
      v_qual := regexp_replace(v_qual,'auth\.jwt\(\)','(select auth.jwt())','g');
      v_qual := regexp_replace(v_qual,'auth\.role\(\)','(select auth.role())','g');
      v_qual := replace(replace(replace(v_qual,'__S_UID__','(select auth.uid())'),'__S_JWT__','(select auth.jwt())'),'__S_ROL__','(select auth.role())');
    END IF;
    IF v_check IS NOT NULL THEN
      v_check := regexp_replace(v_check,'\(\s*SELECT\s+auth\.uid\(\)[^)]*\)','__S_UID__','gi');
      v_check := regexp_replace(v_check,'\(\s*SELECT\s+auth\.jwt\(\)[^)]*\)','__S_JWT__','gi');
      v_check := regexp_replace(v_check,'\(\s*SELECT\s+auth\.role\(\)[^)]*\)','__S_ROL__','gi');
      v_check := regexp_replace(v_check,'auth\.uid\(\)','(select auth.uid())','g');
      v_check := regexp_replace(v_check,'auth\.jwt\(\)','(select auth.jwt())','g');
      v_check := regexp_replace(v_check,'auth\.role\(\)','(select auth.role())','g');
      v_check := replace(replace(replace(v_check,'__S_UID__','(select auth.uid())'),'__S_JWT__','(select auth.jwt())'),'__S_ROL__','(select auth.role())');
    END IF;
    IF v_qual IS NOT DISTINCT FROM r.qual AND v_check IS NOT DISTINCT FROM r.with_check THEN CONTINUE; END IF;
    v_perm := CASE WHEN r.permissive='PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END;
    SELECT string_agg(quote_ident(rn),', ') INTO v_roles_csv FROM unnest(r.roles) AS rn;
    v_using := CASE WHEN v_qual IS NOT NULL THEN ' USING ('||v_qual||')' ELSE '' END;
    v_with  := CASE WHEN v_check IS NOT NULL THEN ' WITH CHECK ('||v_check||')' ELSE '' END;
    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    EXECUTE format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
      r.policyname, r.schemaname, r.tablename, v_perm, r.cmd, v_roles_csv, v_using, v_with);
    v_count := v_count + 1;
  END LOOP;
  SELECT count(*) INTO v_pending FROM pg_policies
  WHERE schemaname='public' AND tablename ~* v_filter
    AND (regexp_replace(COALESCE(qual,''),'\(\s*SELECT\s+auth\.(uid|jwt|role)\(\)[^)]*\)','','gi') ~* 'auth\.(uid|jwt|role)\(\)'
      OR regexp_replace(COALESCE(with_check,''),'\(\s*SELECT\s+auth\.(uid|jwt|role)\(\)[^)]*\)','','gi') ~* 'auth\.(uid|jwt|role)\(\)');
  RAISE NOTICE 'Phase 2B (trade_vendas): rewrapped %; pending = %', v_count, v_pending;
  IF v_pending > 0 THEN RAISE EXCEPTION 'Phase 2B (trade_vendas): % pendentes', v_pending; END IF;
END $migration$;