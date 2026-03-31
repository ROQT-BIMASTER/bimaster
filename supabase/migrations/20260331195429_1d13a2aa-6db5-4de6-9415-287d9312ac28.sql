
-- 6. social_media_credentials — safe view
CREATE OR REPLACE VIEW social_media_credentials_safe
WITH (security_invoker = true) AS
SELECT id, user_id, platform,
       '***masked***'::text as access_token,
       '***masked***'::text as refresh_token,
       token_type, expires_at, scope, created_at, updated_at
FROM social_media_credentials;

-- 7. social_media_accounts — safe view (correct columns)
CREATE OR REPLACE VIEW social_media_accounts_safe
WITH (security_invoker = true) AS
SELECT id, user_id, platform, account_name, username,
       '***masked***'::text as access_token,
       status, created_at, updated_at, last_sync_at
FROM social_media_accounts;

-- 8. contas_pagar_historico — restringir a financeiro
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'contas_pagar_historico' AND schemaname = 'public'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON contas_pagar_historico', r.policyname); END LOOP;
END $$;
CREATE POLICY "cph_select" ON contas_pagar_historico FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'admin'));

-- 9. plano_contas_auditoria — restringir a financeiro
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'plano_contas_auditoria' AND schemaname = 'public'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON plano_contas_auditoria', r.policyname); END LOOP;
END $$;
CREATE POLICY "pca_select" ON plano_contas_auditoria FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "pca_insert" ON plano_contas_auditoria FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'admin'));
