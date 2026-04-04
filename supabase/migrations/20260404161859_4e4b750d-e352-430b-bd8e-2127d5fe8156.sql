
-- =====================================================
-- ITEM 1: Criptografia de tokens OAuth
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE social_media_credentials 
  ADD COLUMN IF NOT EXISTS access_token_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS refresh_token_encrypted BYTEA;

ALTER TABLE ads_accounts
  ADD COLUMN IF NOT EXISTS credentials_enc BYTEA;

CREATE OR REPLACE FUNCTION encrypt_token(p_token TEXT)
RETURNS BYTEA LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_key TEXT;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN RETURN NULL; END IF;
  v_key := current_setting('app.settings.service_role_key', true);
  IF v_key IS NULL OR v_key = '' THEN v_key := 'default-encryption-key-change-in-production'; END IF;
  RETURN pgp_sym_encrypt(p_token, v_key);
END;
$$;

CREATE OR REPLACE FUNCTION decrypt_token(p_encrypted BYTEA)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_key TEXT;
BEGIN
  IF p_encrypted IS NULL THEN RETURN NULL; END IF;
  v_key := current_setting('app.settings.service_role_key', true);
  IF v_key IS NULL OR v_key = '' THEN v_key := 'default-encryption-key-change-in-production'; END IF;
  RETURN pgp_sym_decrypt(p_encrypted, v_key);
END;
$$;

UPDATE social_media_credentials
SET access_token_encrypted = encrypt_token(access_token),
    refresh_token_encrypted = encrypt_token(refresh_token)
WHERE access_token IS NOT NULL AND access_token_encrypted IS NULL;

UPDATE ads_accounts
SET credentials_enc = encrypt_token(credentials_encrypted)
WHERE credentials_encrypted IS NOT NULL AND credentials_enc IS NULL;

DROP VIEW IF EXISTS social_media_credentials_safe CASCADE;

ALTER TABLE social_media_credentials 
  DROP COLUMN IF EXISTS access_token CASCADE,
  DROP COLUMN IF EXISTS refresh_token CASCADE;

ALTER TABLE ads_accounts
  DROP COLUMN IF EXISTS credentials_encrypted CASCADE;

-- Recriar view safe com colunas reais
CREATE VIEW social_media_credentials_safe AS
SELECT id, user_id, platform, token_type, expires_at, scope,
  created_at, updated_at,
  CASE WHEN access_token_encrypted IS NOT NULL THEN true ELSE false END AS has_token
FROM social_media_credentials;

-- =====================================================
-- ITEM 2: Rate Limiting
-- =====================================================

CREATE TABLE IF NOT EXISTS security_rate_limit_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_pattern TEXT NOT NULL UNIQUE,
  max_requests INT NOT NULL DEFAULT 100,
  window_seconds INT NOT NULL DEFAULT 60,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE security_rate_limit_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage rate limit config"
  ON security_rate_limit_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read rate limit config"
  ON security_rate_limit_config FOR SELECT TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS security_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL,
  identifier TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('minute', now()),
  request_count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(endpoint, identifier, window_start)
);
ALTER TABLE security_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage rate limits"
  ON security_rate_limits FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON security_rate_limits(endpoint, identifier, window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup ON security_rate_limits(created_at);

CREATE OR REPLACE FUNCTION check_endpoint_rate_limit(p_endpoint TEXT, p_identifier TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_max INT; v_window INT; v_start TIMESTAMPTZ; v_count INT;
BEGIN
  SELECT max_requests, window_seconds INTO v_max, v_window
  FROM security_rate_limit_config
  WHERE p_endpoint LIKE endpoint_pattern
  ORDER BY length(endpoint_pattern) DESC LIMIT 1;
  IF v_max IS NULL THEN RETURN true; END IF;
  v_start := date_trunc('minute', now());
  INSERT INTO security_rate_limits (endpoint, identifier, window_start, request_count)
  VALUES (p_endpoint, p_identifier, v_start, 1)
  ON CONFLICT (endpoint, identifier, window_start)
  DO UPDATE SET request_count = security_rate_limits.request_count + 1
  RETURNING request_count INTO v_count;
  IF v_count > v_max THEN
    INSERT INTO security_audit_log (action, severity, metadata)
    VALUES ('rate_limit_exceeded', 'medium', jsonb_build_object('endpoint', p_endpoint, 'identifier', p_identifier, 'count', v_count, 'limit', v_max));
    RETURN false;
  END IF;
  RETURN true;
END;
$$;

INSERT INTO security_rate_limit_config (endpoint_pattern, max_requests, window_seconds, description) VALUES
  ('whatsapp-webhook', 100, 60, 'WhatsApp webhook: 100 req/min'),
  ('social-media-cron', 30, 60, 'Social media cron: 30 req/min'),
  ('process-photo-analysis-queue', 30, 60, 'Photo analysis worker: 30 req/min'),
  ('export-%', 10, 3600, 'Export endpoints: 10 req/hour'),
  ('%', 200, 60, 'Default: 200 req/min')
ON CONFLICT (endpoint_pattern) DO NOTHING;

CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN DELETE FROM security_rate_limits WHERE created_at < now() - INTERVAL '2 hours'; END;
$$;

-- =====================================================
-- ITEM 3: Rotação de Secrets
-- =====================================================

CREATE TABLE IF NOT EXISTS secret_rotation_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_name TEXT NOT NULL UNIQUE,
  description TEXT,
  rotation_interval_days INT NOT NULL DEFAULT 90,
  last_rotated_at TIMESTAMPTZ,
  next_rotation_at TIMESTAMPTZ,
  rotated_by TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'expired')),
  notification_days_before INT NOT NULL DEFAULT 7,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE secret_rotation_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage rotation schedule"
  ON secret_rotation_schedule FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE VIEW secrets_expiring_soon AS
SELECT secret_name, description, last_rotated_at, next_rotation_at,
  rotation_interval_days,
  EXTRACT(DAY FROM (next_rotation_at - now()))::INT AS days_until_expiry,
  CASE 
    WHEN next_rotation_at < now() THEN 'expired'
    WHEN next_rotation_at < now() + INTERVAL '7 days' THEN 'expiring_soon'
    ELSE 'ok'
  END AS rotation_status
FROM secret_rotation_schedule WHERE status = 'active';

INSERT INTO secret_rotation_schedule (secret_name, description, rotation_interval_days, last_rotated_at, next_rotation_at) VALUES
  ('OPENAI_API_KEY', 'Chave API OpenAI', 90, now(), now() + INTERVAL '90 days'),
  ('STRIPE_SECRET_KEY', 'Chave secreta Stripe', 90, now(), now() + INTERVAL '90 days'),
  ('RESEND_API_KEY', 'Chave API Resend', 90, now(), now() + INTERVAL '90 days'),
  ('PLUGGY_CLIENT_SECRET', 'Secret Pluggy', 90, now(), now() + INTERVAL '90 days'),
  ('ERP_SQL_PASSWORD', 'Senha SQL ERP', 90, now(), now() + INTERVAL '90 days'),
  ('N8N_API_KEY', 'Chave API n8n', 90, now(), now() + INTERVAL '90 days'),
  ('ELEVENLABS_API_KEY', 'Chave ElevenLabs', 90, now(), now() + INTERVAL '90 days'),
  ('EXPORT_API_KEY', 'Chave API exportação', 90, now(), now() + INTERVAL '90 days')
ON CONFLICT (secret_name) DO NOTHING;
