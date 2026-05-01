-- =========================================
-- FASE 2: MFA TOTP + Step-up Authentication
-- =========================================

CREATE TABLE IF NOT EXISTS public.mfa_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  secret_encrypted TEXT NOT NULL,
  recovery_codes_hash TEXT[] NOT NULL DEFAULT '{}',
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.mfa_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own mfa enrollment" ON public.mfa_enrollments
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.mfa_step_up_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL,
  consumed BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_step_up_user ON public.mfa_step_up_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_step_up_expires ON public.mfa_step_up_tokens(expires_at);
ALTER TABLE public.mfa_step_up_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own step-up tokens" ON public.mfa_step_up_tokens
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.mfa_required_roles (
  role public.app_role PRIMARY KEY,
  enforced_since TIMESTAMPTZ NOT NULL DEFAULT now(),
  added_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.mfa_required_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth reads required roles" ON public.mfa_required_roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manages required roles" ON public.mfa_required_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.mfa_required_roles (role) VALUES ('admin'), ('gerente')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.device_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint_hash TEXT NOT NULL,
  user_agent TEXT,
  ip_first_seen INET,
  ip_last_seen INET,
  trusted BOOLEAN NOT NULL DEFAULT false,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, fingerprint_hash)
);
CREATE INDEX IF NOT EXISTS idx_device_user ON public.device_fingerprints(user_id);
ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own devices" ON public.device_fingerprints
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users update own devices" ON public.device_fingerprints
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.user_requires_mfa(_uid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.mfa_required_roles mrr ON mrr.role = ur.role
    WHERE ur.user_id = _uid
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_active_mfa(_uid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mfa_enrollments
    WHERE user_id = _uid AND verified = true
  );
$$;

CREATE OR REPLACE FUNCTION public.validate_step_up_token(_uid UUID, _token_hash TEXT, _scope TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE _ok BOOLEAN := false;
BEGIN
  UPDATE public.mfa_step_up_tokens
  SET consumed = true
  WHERE user_id = _uid AND token_hash = _token_hash AND scope = _scope
    AND consumed = false AND expires_at > now()
  RETURNING true INTO _ok;
  RETURN COALESCE(_ok, false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.user_requires_mfa(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_has_active_mfa(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_step_up_token(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_requires_mfa(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_active_mfa(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_step_up_token(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.purge_expired_step_up_tokens()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  DELETE FROM public.mfa_step_up_tokens WHERE expires_at < now() - INTERVAL '1 hour';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_purge_step_up ON public.mfa_step_up_tokens;
CREATE TRIGGER trg_purge_step_up
AFTER INSERT ON public.mfa_step_up_tokens
FOR EACH STATEMENT EXECUTE FUNCTION public.purge_expired_step_up_tokens();

-- ========================================
-- FASE 5 (parcial): Audit log e PII helpers
-- ========================================
CREATE OR REPLACE FUNCTION public.mask_cpf(_cpf TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp AS $$
  SELECT CASE
    WHEN _cpf IS NULL OR length(regexp_replace(_cpf, '\D', '', 'g')) < 11 THEN _cpf
    ELSE '***.' || substring(regexp_replace(_cpf, '\D', '', 'g'), 4, 3) || '.' || substring(regexp_replace(_cpf, '\D', '', 'g'), 7, 3) || '-**'
  END;
$$;

CREATE OR REPLACE FUNCTION public.mask_email(_email TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp AS $$
  SELECT CASE
    WHEN _email IS NULL OR position('@' in _email) < 2 THEN _email
    ELSE substring(_email, 1, 1) || '***@' || split_part(_email, '@', 2)
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.mask_cpf(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mask_email(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mask_cpf(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mask_email(TEXT) TO authenticated;

-- ========================================
-- FASE 6: SIEM correlation rules
-- ========================================
CREATE TABLE IF NOT EXISTS public.siem_correlation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  threshold INTEGER NOT NULL DEFAULT 5,
  window_seconds INTEGER NOT NULL DEFAULT 300,
  severity TEXT NOT NULL DEFAULT 'warn',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.siem_correlation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages siem rules" ON public.siem_correlation_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.siem_correlation_rules (rule_key, description, threshold, window_seconds, severity) VALUES
  ('credential_stuffing', 'Múltiplas falhas de autenticação do mesmo IP em janela curta', 10, 300, 'error'),
  ('impossible_travel', 'Login a partir de geolocalizações distantes em curto intervalo', 1, 600, 'error'),
  ('mass_export', 'Volume anormal de exportações por um único usuário', 50, 3600, 'warn'),
  ('privilege_escalation', 'Tentativas de mudança de role sem step-up', 1, 60, 'error')
ON CONFLICT (rule_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.siem_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key TEXT NOT NULL,
  user_id UUID,
  ip INET,
  severity TEXT NOT NULL,
  matched_count INTEGER NOT NULL DEFAULT 1,
  payload JSONB,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_siem_alerts_created ON public.siem_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_siem_alerts_user ON public.siem_alerts(user_id);
ALTER TABLE public.siem_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin sees siem alerts" ON public.siem_alerts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin acks siem alerts" ON public.siem_alerts
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========================================
-- FASE 3: WAF v2 — Geo/ASN policies
-- ========================================
CREATE TABLE IF NOT EXISTS public.waf_geo_policy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code CHAR(2) NOT NULL UNIQUE,
  action TEXT NOT NULL DEFAULT 'allow' CHECK (action IN ('allow','challenge','block')),
  reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.waf_geo_policy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth reads geo policy" ON public.waf_geo_policy
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manages geo policy" ON public.waf_geo_policy
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.waf_geo_policy (country_code, action, reason) VALUES
  ('BR', 'allow', 'Mercado primário'),
  ('CN', 'allow', 'Operação China-Brasil'),
  ('US', 'allow', 'Mercado secundário'),
  ('PT', 'allow', 'Mercado UE'),
  ('KP', 'block', 'Sanctioned country'),
  ('IR', 'block', 'Sanctioned country'),
  ('SY', 'block', 'Sanctioned country'),
  ('CU', 'block', 'Sanctioned country')
ON CONFLICT (country_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.waf_bot_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip INET NOT NULL,
  ua_hash TEXT,
  signal_type TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bot_signals_ip_time ON public.waf_bot_signals(ip, created_at DESC);
ALTER TABLE public.waf_bot_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin sees bot signals" ON public.waf_bot_signals
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));