
-- =====================================================================
-- FASE 5+6 — Fundação: Audit imutável, security events, quarentena, LGPD
-- =====================================================================

-- ---------- Helper: garantir tabela só pode receber INSERT ----------
-- (políticas RLS sem UPDATE/DELETE + revogação direta)

-- ===== 1) AUDIT LOG IMUTÁVEL com HASH CHAIN =====
CREATE TABLE IF NOT EXISTS public.audit_log_immutable (
  id          BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id    UUID,
  actor_email TEXT,
  action      TEXT NOT NULL,            -- ex: 'INSERT','UPDATE','DELETE','LOGIN','EXPORT'
  entity      TEXT NOT NULL,            -- ex: 'contas_pagar','user_roles'
  entity_id   TEXT,
  before_data JSONB,
  after_data  JSONB,
  ip          TEXT,
  user_agent  TEXT,
  request_id  TEXT,
  prev_hash   TEXT,
  row_hash    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_log_immutable_occurred_idx ON public.audit_log_immutable(occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_immutable_actor_idx ON public.audit_log_immutable(actor_id);
CREATE INDEX IF NOT EXISTS audit_log_immutable_entity_idx ON public.audit_log_immutable(entity, entity_id);

ALTER TABLE public.audit_log_immutable ENABLE ROW LEVEL SECURITY;

-- Sem permissões diretas para usuários — append-only via função
REVOKE ALL ON public.audit_log_immutable FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.audit_log_immutable TO authenticated;  -- via RLS

-- Trigger que calcula prev_hash + row_hash em cadeia
CREATE OR REPLACE FUNCTION public.audit_log_immutable_seal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  last_hash TEXT;
BEGIN
  SELECT row_hash INTO last_hash
  FROM public.audit_log_immutable
  ORDER BY id DESC LIMIT 1;

  NEW.prev_hash := COALESCE(last_hash, '0');
  NEW.row_hash := encode(
    digest(
      coalesce(NEW.prev_hash,'') ||
      coalesce(NEW.occurred_at::text,'') ||
      coalesce(NEW.actor_id::text,'') ||
      coalesce(NEW.action,'') ||
      coalesce(NEW.entity,'') ||
      coalesce(NEW.entity_id,'') ||
      coalesce(NEW.before_data::text,'') ||
      coalesce(NEW.after_data::text,'')
    , 'sha256'),
    'hex'
  );
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.audit_log_immutable_seal() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_log_immutable_seal_trg ON public.audit_log_immutable;
CREATE TRIGGER audit_log_immutable_seal_trg
  BEFORE INSERT ON public.audit_log_immutable
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_immutable_seal();

-- Bloquear UPDATE/DELETE absolutamente (também via trigger, defesa em profundidade)
CREATE OR REPLACE FUNCTION public.audit_log_immutable_block()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log_immutable é append-only — operação % proibida', TG_OP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.audit_log_immutable_block() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_log_immutable_no_update ON public.audit_log_immutable;
CREATE TRIGGER audit_log_immutable_no_update
  BEFORE UPDATE OR DELETE OR TRUNCATE ON public.audit_log_immutable
  FOR EACH STATEMENT EXECUTE FUNCTION public.audit_log_immutable_block();

-- Política: apenas admins podem SELECT
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname='has_role') THEN
    EXECUTE $POL$
      CREATE POLICY audit_log_immutable_select_admin ON public.audit_log_immutable
        FOR SELECT TO authenticated
        USING (public.has_role(auth.uid(), 'admin'::app_role))
    $POL$;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
WHEN OTHERS THEN
  RAISE NOTICE 'Skip audit_log_immutable policy: %', SQLERRM;
END $$;

-- API segura para registrar auditoria
CREATE OR REPLACE FUNCTION public.audit_log_record(
  p_action      TEXT,
  p_entity      TEXT,
  p_entity_id   TEXT DEFAULT NULL,
  p_before      JSONB DEFAULT NULL,
  p_after       JSONB DEFAULT NULL,
  p_ip          TEXT DEFAULT NULL,
  p_user_agent  TEXT DEFAULT NULL,
  p_request_id  TEXT DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id BIGINT;
  v_email TEXT;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.audit_log_immutable
    (actor_id, actor_email, action, entity, entity_id, before_data, after_data, ip, user_agent, request_id)
  VALUES
    (auth.uid(), v_email, p_action, p_entity, p_entity_id, p_before, p_after, p_ip, p_user_agent, p_request_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.audit_log_record(TEXT,TEXT,TEXT,JSONB,JSONB,TEXT,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_log_record(TEXT,TEXT,TEXT,JSONB,JSONB,TEXT,TEXT,TEXT) TO authenticated, service_role;

-- Verificador de integridade da cadeia
CREATE OR REPLACE FUNCTION public.audit_log_verify_chain(p_limit INT DEFAULT 1000)
RETURNS TABLE(broken_at_id BIGINT, expected_hash TEXT, actual_hash TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r RECORD;
  v_prev TEXT := '0';
  v_calc TEXT;
BEGIN
  FOR r IN
    SELECT * FROM public.audit_log_immutable ORDER BY id ASC LIMIT p_limit
  LOOP
    v_calc := encode(
      digest(
        v_prev ||
        coalesce(r.occurred_at::text,'') ||
        coalesce(r.actor_id::text,'') ||
        coalesce(r.action,'') ||
        coalesce(r.entity,'') ||
        coalesce(r.entity_id,'') ||
        coalesce(r.before_data::text,'') ||
        coalesce(r.after_data::text,'')
      , 'sha256'), 'hex'
    );
    IF v_calc <> r.row_hash THEN
      broken_at_id := r.id;
      expected_hash := v_calc;
      actual_hash := r.row_hash;
      RETURN NEXT;
    END IF;
    v_prev := r.row_hash;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.audit_log_verify_chain(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_log_verify_chain(INT) TO authenticated, service_role;

-- ===== 2) SECURITY EVENTS (SIEM consolidado) =====
CREATE TABLE IF NOT EXISTS public.security_events (
  id           BIGSERIAL PRIMARY KEY,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type   TEXT NOT NULL,    -- 'auth_fail','mfa_fail','waf_block','rate_limit','quarantine','anomaly','privilege_escalation','impossible_travel'
  severity     TEXT NOT NULL DEFAULT 'info',   -- 'info','warn','error','critical'
  user_id      UUID,
  ip           TEXT,
  asn          TEXT,
  country      TEXT,
  user_agent   TEXT,
  resource     TEXT,
  details      JSONB
);

CREATE INDEX IF NOT EXISTS security_events_occurred_idx ON public.security_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS security_events_user_idx ON public.security_events(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS security_events_ip_idx ON public.security_events(ip, occurred_at DESC);
CREATE INDEX IF NOT EXISTS security_events_type_sev_idx ON public.security_events(event_type, severity, occurred_at DESC);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.security_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.security_events TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname='has_role') THEN
    EXECUTE $POL$
      CREATE POLICY security_events_select_admin ON public.security_events
        FOR SELECT TO authenticated
        USING (public.has_role(auth.uid(), 'admin'::app_role))
    $POL$;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
WHEN OTHERS THEN RAISE NOTICE 'Skip security_events policy: %', SQLERRM;
END $$;

CREATE OR REPLACE FUNCTION public.security_event_record(
  p_event_type TEXT,
  p_severity   TEXT DEFAULT 'info',
  p_user_id    UUID DEFAULT NULL,
  p_ip         TEXT DEFAULT NULL,
  p_asn        TEXT DEFAULT NULL,
  p_country    TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_resource   TEXT DEFAULT NULL,
  p_details    JSONB DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_id BIGINT;
BEGIN
  INSERT INTO public.security_events
    (event_type, severity, user_id, ip, asn, country, user_agent, resource, details)
  VALUES
    (p_event_type, p_severity, COALESCE(p_user_id, auth.uid()), p_ip, p_asn, p_country, p_user_agent, p_resource, p_details)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.security_event_record(TEXT,TEXT,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.security_event_record(TEXT,TEXT,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) TO authenticated, service_role;

-- ===== 3) QUARENTENA DE CONTA =====
CREATE TABLE IF NOT EXISTS public.account_quarantine (
  user_id      UUID PRIMARY KEY,
  quarantined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  quarantined_by UUID,
  reason       TEXT NOT NULL,
  expires_at   TIMESTAMPTZ,
  released_at  TIMESTAMPTZ,
  released_by  UUID
);
ALTER TABLE public.account_quarantine ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_quarantine FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.account_quarantine TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname='has_role') THEN
    EXECUTE $POL$
      CREATE POLICY account_quarantine_admin ON public.account_quarantine
        FOR SELECT TO authenticated
        USING (public.has_role(auth.uid(), 'admin'::app_role) OR user_id = auth.uid())
    $POL$;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
WHEN OTHERS THEN RAISE NOTICE 'Skip quarantine policy: %', SQLERRM;
END $$;

CREATE OR REPLACE FUNCTION public.is_account_quarantined(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_quarantine
    WHERE user_id = _user_id
      AND released_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_account_quarantined(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_account_quarantined(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.account_quarantine_set(
  p_user_id UUID,
  p_reason TEXT,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem colocar contas em quarentena';
  END IF;

  INSERT INTO public.account_quarantine (user_id, quarantined_by, reason, expires_at)
  VALUES (p_user_id, auth.uid(), p_reason, p_expires_at)
  ON CONFLICT (user_id) DO UPDATE
    SET quarantined_at = now(),
        quarantined_by = auth.uid(),
        reason = EXCLUDED.reason,
        expires_at = EXCLUDED.expires_at,
        released_at = NULL,
        released_by = NULL;

  PERFORM public.security_event_record(
    'quarantine','critical', p_user_id, NULL, NULL, NULL, NULL, 'account',
    jsonb_build_object('reason', p_reason, 'by', auth.uid())
  );
  PERFORM public.audit_log_record(
    'QUARANTINE','account', p_user_id::text, NULL,
    jsonb_build_object('reason', p_reason, 'expires_at', p_expires_at)
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.account_quarantine_set(UUID,TEXT,TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_quarantine_set(UUID,TEXT,TIMESTAMPTZ) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.account_quarantine_release(p_user_id UUID, p_note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem liberar contas';
  END IF;
  UPDATE public.account_quarantine
    SET released_at = now(), released_by = auth.uid()
    WHERE user_id = p_user_id AND released_at IS NULL;

  PERFORM public.audit_log_record(
    'QUARANTINE_RELEASE','account', p_user_id::text, NULL,
    jsonb_build_object('note', p_note, 'by', auth.uid())
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.account_quarantine_release(UUID,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_quarantine_release(UUID,TEXT) TO authenticated, service_role;

-- ===== 4) LGPD CONSENTS =====
CREATE TABLE IF NOT EXISTS public.lgpd_consents (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL,
  purpose     TEXT NOT NULL,
  version     TEXT NOT NULL,
  granted     BOOLEAN NOT NULL,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at  TIMESTAMPTZ,
  ip          TEXT,
  user_agent  TEXT
);
CREATE INDEX IF NOT EXISTS lgpd_consents_user_idx ON public.lgpd_consents(user_id, purpose, granted_at DESC);
ALTER TABLE public.lgpd_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lgpd_consents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.lgpd_consents TO authenticated;

CREATE POLICY lgpd_consents_self ON public.lgpd_consents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ===== 5) DEVICES CONFIÁVEIS =====
CREATE TABLE IF NOT EXISTS public.user_trusted_devices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  fingerprint TEXT NOT NULL,
  device_name TEXT,
  user_agent  TEXT,
  last_ip     TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trusted     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, fingerprint)
);
CREATE INDEX IF NOT EXISTS user_trusted_devices_user_idx ON public.user_trusted_devices(user_id);
ALTER TABLE public.user_trusted_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_trusted_devices FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.user_trusted_devices TO authenticated;

CREATE POLICY trusted_devices_self_select ON public.user_trusted_devices
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY trusted_devices_self_update ON public.user_trusted_devices
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY trusted_devices_self_delete ON public.user_trusted_devices
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.user_device_register(
  p_fingerprint TEXT,
  p_device_name TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
  v_is_new BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;

  INSERT INTO public.user_trusted_devices (user_id, fingerprint, device_name, last_ip, user_agent)
  VALUES (auth.uid(), p_fingerprint, p_device_name, p_ip, p_user_agent)
  ON CONFLICT (user_id, fingerprint) DO UPDATE
    SET last_seen_at = now(), last_ip = EXCLUDED.last_ip, user_agent = EXCLUDED.user_agent
  RETURNING id, (xmax = 0) INTO v_id, v_is_new;

  IF v_is_new THEN
    PERFORM public.security_event_record(
      'new_device','warn', auth.uid(), p_ip, NULL, NULL, p_user_agent, 'device',
      jsonb_build_object('fingerprint', p_fingerprint, 'device_id', v_id)
    );
  END IF;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.user_device_register(TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_device_register(TEXT,TEXT,TEXT,TEXT) TO authenticated, service_role;
