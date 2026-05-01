-- v3.4.70 — Pentest interno + 6 camadas adicionais (corrigido)

-- Pentest
CREATE TABLE IF NOT EXISTS public.pentest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  mode text NOT NULL CHECK (mode IN ('dry_run', 'full')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'aborted')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  total_checks integer DEFAULT 0,
  passed integer DEFAULT 0,
  failed integer DEFAULT 0,
  skipped integer DEFAULT 0,
  score numeric(5,2),
  notes text
);
CREATE INDEX IF NOT EXISTS idx_pentest_runs_started ON public.pentest_runs(started_at DESC);

CREATE TABLE IF NOT EXISTS public.pentest_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.pentest_runs(id) ON DELETE CASCADE,
  check_id text NOT NULL,
  category text NOT NULL,
  cwe_id text,
  severity text NOT NULL CHECK (severity IN ('info','low','medium','high','critical')),
  result text NOT NULL CHECK (result IN ('pass','fail','skip','error')),
  title text NOT NULL,
  description text,
  evidence jsonb,
  evidence_hash text,
  remediation text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pentest_findings_run ON public.pentest_findings(run_id);
CREATE INDEX IF NOT EXISTS idx_pentest_findings_result ON public.pentest_findings(result, severity);

ALTER TABLE public.pentest_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pentest_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pentest_runs_admin_select" ON public.pentest_runs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "pentest_findings_admin_select" ON public.pentest_findings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Anti-abuso comportamental
CREATE TABLE IF NOT EXISTS public.user_behavior_baseline (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  avg_req_per_min numeric DEFAULT 0,
  stddev_req_per_min numeric DEFAULT 0,
  typical_hours int[] DEFAULT '{}',
  known_ips text[] DEFAULT '{}',
  known_asns text[] DEFAULT '{}',
  known_user_agents text[] DEFAULT '{}',
  known_countries text[] DEFAULT '{}',
  sample_count integer DEFAULT 0,
  last_updated timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.anomaly_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  anomaly_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info','low','medium','high','critical')),
  signal jsonb NOT NULL,
  ip text, asn text, country text, user_agent text,
  resolved boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_anomaly_events_user_time ON public.anomaly_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomaly_events_unresolved ON public.anomaly_events(created_at DESC) WHERE resolved = false;

ALTER TABLE public.user_behavior_baseline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anomaly_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "behavior_baseline_admin" ON public.user_behavior_baseline
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());
CREATE POLICY "anomaly_events_admin" ON public.anomaly_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Cofre de segredos
CREATE TABLE IF NOT EXISTS public.secret_rotation_policy (
  secret_name text PRIMARY KEY,
  rotation_interval_days integer NOT NULL DEFAULT 90,
  last_rotated_at timestamptz,
  owner_email text,
  category text DEFAULT 'general',
  is_critical boolean DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.secret_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_name text NOT NULL,
  accessed_by_function text,
  accessed_at timestamptz NOT NULL DEFAULT now(),
  request_id text
);
CREATE INDEX IF NOT EXISTS idx_secret_access_time ON public.secret_access_log(accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_secret_access_name ON public.secret_access_log(secret_name, accessed_at DESC);

ALTER TABLE public.secret_rotation_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secret_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "secret_policy_admin" ON public.secret_rotation_policy
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "secret_access_admin" ON public.secret_access_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.secret_rotation_policy (secret_name, rotation_interval_days, category, is_critical) VALUES
  ('LOVABLE_API_KEY', 90, 'ai_gateway', true),
  ('STRIPE_SECRET_KEY', 90, 'payments', true),
  ('SUPABASE_SERVICE_ROLE_KEY', 180, 'infra', true),
  ('ERP_API_KEY', 90, 'erp', true),
  ('FAL_KEY', 180, 'ai_creative', false)
ON CONFLICT (secret_name) DO NOTHING;

-- Supply chain
CREATE TABLE IF NOT EXISTS public.dependency_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL,
  package_name text NOT NULL,
  installed_version text,
  vulnerable_versions text,
  severity text CHECK (severity IN ('info','low','moderate','high','critical')),
  cve_ids text[],
  advisory_url text,
  recommendation text,
  status text DEFAULT 'open' CHECK (status IN ('open','acknowledged','fixed','ignored')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dep_findings_scan ON public.dependency_findings(scan_id);
CREATE INDEX IF NOT EXISTS idx_dep_findings_open ON public.dependency_findings(severity, created_at DESC) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS public.app_integrity_baseline (
  id text PRIMARY KEY,
  hash text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid
);

ALTER TABLE public.dependency_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_integrity_baseline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dep_findings_admin" ON public.dependency_findings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "integrity_admin" ON public.app_integrity_baseline
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Global rate limit
CREATE TABLE IF NOT EXISTS public.global_rate_limit_buckets (
  identifier text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0,
  last_request_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_global_rl_window ON public.global_rate_limit_buckets(window_start);
ALTER TABLE public.global_rate_limit_buckets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.global_rate_limit_check(_identifier text, _limit integer DEFAULT 1000)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _window_start timestamptz := date_trunc('minute', now()); _count integer;
BEGIN
  INSERT INTO public.global_rate_limit_buckets (identifier, window_start, request_count, last_request_at)
  VALUES (_identifier, _window_start, 1, now())
  ON CONFLICT (identifier) DO UPDATE
    SET request_count = CASE WHEN global_rate_limit_buckets.window_start = _window_start
            THEN global_rate_limit_buckets.request_count + 1 ELSE 1 END,
        window_start = _window_start, last_request_at = now()
  RETURNING request_count INTO _count;
  RETURN jsonb_build_object('allowed', _count <= _limit, 'count', _count, 'limit', _limit,
    'remaining', GREATEST(0, _limit - _count), 'reset_at', _window_start + interval '1 minute');
END; $$;
REVOKE EXECUTE ON FUNCTION public.global_rate_limit_check(text, integer) FROM public, anon, authenticated;

-- Incident timeline
CREATE TABLE IF NOT EXISTS public.incident_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL,
  user_id uuid, ip text,
  event_source text NOT NULL,
  event_type text NOT NULL,
  details jsonb,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_incident_timeline_incident ON public.incident_timeline(incident_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_incident_timeline_user ON public.incident_timeline(user_id, occurred_at DESC);
ALTER TABLE public.incident_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "incident_timeline_admin" ON public.incident_timeline
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RPC: incident snapshot
CREATE OR REPLACE FUNCTION public.incident_snapshot(_user_id uuid, _hours integer DEFAULT 24)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _result jsonb; _since timestamptz := now() - make_interval(hours => _hours);
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object(
    'user_id', _user_id, 'window_hours', _hours, 'generated_at', now(),
    'security_events', COALESCE((SELECT jsonb_agg(to_jsonb(s.*) ORDER BY s.created_at DESC)
      FROM public.security_events s WHERE s.user_id = _user_id AND s.created_at >= _since LIMIT 500), '[]'::jsonb),
    'anomalies', COALESCE((SELECT jsonb_agg(to_jsonb(a.*) ORDER BY a.created_at DESC)
      FROM public.anomaly_events a WHERE a.user_id = _user_id AND a.created_at >= _since LIMIT 200), '[]'::jsonb),
    'devices', COALESCE((SELECT jsonb_agg(to_jsonb(d.*))
      FROM public.user_trusted_devices d WHERE d.user_id = _user_id), '[]'::jsonb),
    'quarantine', (SELECT to_jsonb(q.*) FROM public.account_quarantine q
      WHERE q.user_id = _user_id ORDER BY q.quarantined_at DESC LIMIT 1)
  ) INTO _result;
  RETURN _result;
END; $$;
REVOKE EXECUTE ON FUNCTION public.incident_snapshot(uuid, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.incident_snapshot(uuid, integer) TO authenticated;

-- RPC: anomaly_record (auto-quarantine após 3 high+ em 1h)
CREATE OR REPLACE FUNCTION public.anomaly_record(
  _user_id uuid, _type text, _severity text, _signal jsonb,
  _ip text DEFAULT NULL, _asn text DEFAULT NULL, _country text DEFAULT NULL, _user_agent text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _id uuid; _recent integer;
BEGIN
  INSERT INTO public.anomaly_events (user_id, anomaly_type, severity, signal, ip, asn, country, user_agent)
  VALUES (_user_id, _type, _severity, _signal, _ip, _asn, _country, _user_agent) RETURNING id INTO _id;
  IF _user_id IS NOT NULL AND _severity IN ('high','critical') THEN
    SELECT count(*) INTO _recent FROM public.anomaly_events
      WHERE user_id = _user_id AND severity IN ('high','critical') AND created_at > now() - interval '1 hour';
    IF _recent >= 3 THEN
      INSERT INTO public.account_quarantine (user_id, reason, quarantined_by, expires_at)
      VALUES (_user_id, 'Auto-quarantine: 3+ high anomalies in 1h', NULL, now() + interval '1 hour')
      ON CONFLICT (user_id) DO NOTHING;
    END IF;
  END IF;
  RETURN _id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.anomaly_record(uuid, text, text, jsonb, text, text, text, text) FROM public, anon, authenticated;

-- RPC: secret access audit
CREATE OR REPLACE FUNCTION public.secret_audit_access(_secret_name text, _function_name text, _request_id text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.secret_access_log (secret_name, accessed_by_function, request_id)
  VALUES (_secret_name, _function_name, _request_id);
END; $$;
REVOKE EXECUTE ON FUNCTION public.secret_audit_access(text, text, text) FROM public, anon, authenticated;

-- RPC: dashboard metrics v2
CREATE OR REPLACE FUNCTION public.security_v2_metrics()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object(
    'mfa_enrolled', (SELECT count(*) FROM public.mfa_enrollments WHERE verified_at IS NOT NULL),
    'mfa_required_users', (SELECT count(DISTINCT ur.user_id) FROM public.user_roles ur WHERE ur.role::text IN ('admin','gerente')),
    'waf_shadow_24h', (SELECT count(*) FROM public.security_audit_log WHERE action = 'waf_shadow' AND created_at > now() - interval '24 hours'),
    'anomalies_24h', (SELECT count(*) FROM public.anomaly_events WHERE created_at > now() - interval '24 hours'),
    'quarantined_active', (SELECT count(*) FROM public.account_quarantine WHERE released_at IS NULL AND (expires_at IS NULL OR expires_at > now())),
    'last_pentest_score', (SELECT score FROM public.pentest_runs WHERE status = 'completed' ORDER BY finished_at DESC NULLS LAST LIMIT 1),
    'last_pentest_at', (SELECT finished_at FROM public.pentest_runs WHERE status = 'completed' ORDER BY finished_at DESC NULLS LAST LIMIT 1),
    'open_dep_findings', (SELECT count(*) FROM public.dependency_findings WHERE status = 'open' AND severity IN ('high','critical')),
    'secrets_due_rotation', (SELECT count(*) FROM public.secret_rotation_policy
      WHERE last_rotated_at IS NULL OR last_rotated_at < now() - make_interval(days => rotation_interval_days))
  ) INTO _result;
  RETURN _result;
END; $$;
REVOKE EXECUTE ON FUNCTION public.security_v2_metrics() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.security_v2_metrics() TO authenticated;

-- step_up_scopes: pentest.execute (ttl_seconds = 300)
INSERT INTO public.step_up_scopes (scope, description, ttl_seconds)
VALUES ('pentest.execute', 'Executar pentest em modo full (gravação)', 300)
ON CONFLICT (scope) DO NOTHING;