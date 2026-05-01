-- INSIDER THREAT DEFENSE PROGRAM (v3.4.73)

CREATE TABLE IF NOT EXISTS public.jit_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  scope text NOT NULL,
  justification text NOT NULL,
  requested_minutes integer NOT NULL DEFAULT 30,
  requires_four_eyes boolean NOT NULL DEFAULT false,
  approver_id uuid,
  status text NOT NULL DEFAULT 'pending',
  granted_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  decision_reason text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jit_status_chk CHECK (status IN ('pending','approved','denied','expired','revoked')),
  CONSTRAINT jit_minutes_chk CHECK (requested_minutes BETWEEN 5 AND 240),
  CONSTRAINT jit_no_self_approve CHECK (approver_id IS NULL OR approver_id <> requester_id)
);
CREATE INDEX IF NOT EXISTS idx_jit_requester ON public.jit_access_requests(requester_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jit_pending ON public.jit_access_requests(status, created_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_jit_active ON public.jit_access_requests(requester_id, scope, expires_at) WHERE status = 'approved';

ALTER TABLE public.jit_access_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jit_select_own_or_admin" ON public.jit_access_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR approver_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "jit_insert_own" ON public.jit_access_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());
CREATE POLICY "jit_update_admin_only" ON public.jit_access_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.export_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scope text NOT NULL,
  row_count integer NOT NULL DEFAULT 0,
  file_format text NOT NULL,
  file_hash_sha256 text,
  receipt_token text NOT NULL UNIQUE,
  ip_address text,
  user_agent text,
  request_id text,
  is_massive boolean NOT NULL DEFAULT false,
  jit_request_id uuid REFERENCES public.jit_access_requests(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_export_receipts_user ON public.export_receipts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_receipts_massive ON public.export_receipts(created_at DESC) WHERE is_massive = true;
ALTER TABLE public.export_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "export_receipts_select_own_or_admin" ON public.export_receipts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

ALTER TABLE public.municipios     ADD COLUMN IF NOT EXISTS is_honeytoken boolean NOT NULL DEFAULT false;
ALTER TABLE public.clientes       ADD COLUMN IF NOT EXISTS is_honeytoken boolean NOT NULL DEFAULT false;
ALTER TABLE public.contas_pagar   ADD COLUMN IF NOT EXISTS is_honeytoken boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles       ADD COLUMN IF NOT EXISTS is_honeytoken boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_municipios_honey ON public.municipios(is_honeytoken) WHERE is_honeytoken = true;
CREATE INDEX IF NOT EXISTS idx_clientes_honey   ON public.clientes(is_honeytoken)   WHERE is_honeytoken = true;
CREATE INDEX IF NOT EXISTS idx_contas_pagar_honey ON public.contas_pagar(is_honeytoken) WHERE is_honeytoken = true;
CREATE INDEX IF NOT EXISTS idx_profiles_honey   ON public.profiles(is_honeytoken)   WHERE is_honeytoken = true;

CREATE TABLE IF NOT EXISTS public.honeytoken_hits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  entity_table text NOT NULL,
  entity_id text,
  hit_context text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_honeytoken_hits_recent ON public.honeytoken_hits(created_at DESC);
ALTER TABLE public.honeytoken_hits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "honeytoken_hits_admin_select" ON public.honeytoken_hits FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.behavioral_baselines (
  user_id uuid PRIMARY KEY,
  typical_hour_start smallint,
  typical_hour_end   smallint,
  avg_actions_per_hour numeric,
  avg_exports_per_day  numeric,
  known_ips text[] NOT NULL DEFAULT '{}',
  known_countries text[] NOT NULL DEFAULT '{}',
  known_modules text[] NOT NULL DEFAULT '{}',
  sample_window_days integer NOT NULL DEFAULT 30,
  computed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.behavioral_baselines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "baseline_admin_select" ON public.behavioral_baselines FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.access_review_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_label text NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  opened_by uuid,
  due_at timestamptz NOT NULL,
  closed_at timestamptz,
  status text NOT NULL DEFAULT 'open'
);
CREATE TABLE IF NOT EXISTS public.access_review_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.access_review_cycles(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL,
  current_role_name text NOT NULL,
  reviewer_id uuid,
  decision text,
  decision_at timestamptz,
  decision_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_access_review_cycle ON public.access_review_items(cycle_id);
CREATE INDEX IF NOT EXISTS idx_access_review_pending ON public.access_review_items(cycle_id) WHERE decision IS NULL;
ALTER TABLE public.access_review_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_review_items  ENABLE ROW LEVEL SECURITY;
CREATE POLICY "access_review_cycle_admin" ON public.access_review_cycles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "access_review_items_admin" ON public.access_review_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

INSERT INTO public.step_up_scopes (scope, description, ttl_seconds, enabled) VALUES
  ('device.trust', 'Confiar dispositivo novo', 300, true),
  ('jit.approve', 'Aprovar solicitação JIT', 300, true),
  ('mfa.reset_other', 'Resetar MFA de outro usuário', 300, true),
  ('secret.reveal', 'Revelar segredo mascarado', 180, true),
  ('access.review_decision', 'Decisão em revisão de acesso', 600, true)
ON CONFLICT (scope) DO NOTHING;

-- ===== RPCs =====

CREATE OR REPLACE FUNCTION public.jit_request(_scope text, _justification text, _minutes integer DEFAULT 30)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _uid uuid := auth.uid(); _id uuid; _four_eyes boolean := false;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _justification IS NULL OR length(_justification) < 10 THEN RAISE EXCEPTION 'justification_too_short'; END IF;
  IF _scope IN ('users.role_change_admin','users.role_change_gerente','finance.export_full','municipios.bulk_reassign','mfa.reset_other')
  THEN _four_eyes := true; END IF;
  INSERT INTO public.jit_access_requests (requester_id, scope, justification, requested_minutes, requires_four_eyes)
  VALUES (_uid, _scope, _justification, GREATEST(5, LEAST(_minutes, 240)), _four_eyes)
  RETURNING id INTO _id;
  PERFORM public.audit_log_record('jit_requested','jit_access_requests', _id::text,
    NULL, jsonb_build_object('scope',_scope,'minutes',_minutes,'four_eyes',_four_eyes), NULL, NULL, NULL);
  RETURN _id;
END;$$;
REVOKE ALL ON FUNCTION public.jit_request(text,text,integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.jit_request(text,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.jit_approve(_request_id uuid, _decision text, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _uid uuid := auth.uid(); _row public.jit_access_requests;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF NOT public.has_role(_uid,'admin') THEN RAISE EXCEPTION 'admin_required'; END IF;
  SELECT * INTO _row FROM public.jit_access_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _row.status <> 'pending' THEN RAISE EXCEPTION 'already_decided'; END IF;
  IF _row.requester_id = _uid THEN RAISE EXCEPTION 'self_approval_forbidden'; END IF;
  IF _decision NOT IN ('approved','denied') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  UPDATE public.jit_access_requests
     SET status = _decision, approver_id = _uid, decision_reason = _reason,
         granted_at = CASE WHEN _decision = 'approved' THEN now() END,
         expires_at = CASE WHEN _decision = 'approved' THEN now() + (_row.requested_minutes || ' minutes')::interval END
   WHERE id = _request_id;
  PERFORM public.audit_log_record('jit_'||_decision,'jit_access_requests',_request_id::text,
    NULL, jsonb_build_object('approver',_uid,'reason',_reason,'scope',_row.scope), NULL, NULL, NULL);
  RETURN jsonb_build_object('ok',true,'status',_decision,'expires_at',
    CASE WHEN _decision='approved' THEN now() + (_row.requested_minutes || ' minutes')::interval END);
END;$$;
REVOKE ALL ON FUNCTION public.jit_approve(uuid,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.jit_approve(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.jit_active(_user_id uuid, _scope text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.jit_access_requests
    WHERE requester_id = _user_id AND scope = _scope
      AND status = 'approved' AND expires_at > now() AND revoked_at IS NULL
  );
$$;
REVOKE ALL ON FUNCTION public.jit_active(uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.jit_active(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.export_receipt_create(
  _scope text, _row_count integer, _file_format text,
  _file_hash text DEFAULT NULL, _ip text DEFAULT NULL, _ua text DEFAULT NULL,
  _request_id text DEFAULT NULL, _jit_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _uid uuid := auth.uid(); _token text := encode(gen_random_bytes(18), 'hex');
        _id uuid; _massive boolean := COALESCE(_row_count,0) > 1000;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  INSERT INTO public.export_receipts
    (user_id, scope, row_count, file_format, file_hash_sha256, receipt_token,
     ip_address, user_agent, request_id, is_massive, jit_request_id)
  VALUES (_uid, _scope, COALESCE(_row_count,0), _file_format, _file_hash, _token,
          _ip, _ua, _request_id, _massive, _jit_id)
  RETURNING id INTO _id;
  PERFORM public.security_event_record(
    'data_export', CASE WHEN _massive THEN 'high' ELSE 'info' END,
    _uid, _ip, NULL, NULL, _scope,
    jsonb_build_object('row_count',_row_count,'format',_file_format,'token',_token,'massive',_massive)
  );
  RETURN jsonb_build_object('id',_id,'token',_token,'massive',_massive);
END;$$;
REVOKE ALL ON FUNCTION public.export_receipt_create(text,integer,text,text,text,text,text,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.export_receipt_create(text,integer,text,text,text,text,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.honeytoken_touched(
  _entity_table text, _entity_id text, _context text DEFAULT 'read',
  _ip text DEFAULT NULL, _ua text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  INSERT INTO public.honeytoken_hits (user_id, entity_table, entity_id, hit_context, ip_address, user_agent)
  VALUES (_uid, _entity_table, _entity_id, _context, _ip, _ua);
  PERFORM public.security_event_record('honeytoken_touched','critical',_uid,_ip,NULL,NULL,_entity_table,
    jsonb_build_object('entity_id',_entity_id,'context',_context));
  IF _uid IS NOT NULL THEN
    INSERT INTO public.account_quarantine (user_id, reason, expires_at, quarantined_by)
    VALUES (_uid, 'honeytoken_touched:'||_entity_table, now() + interval '1 hour', _uid)
    ON CONFLICT (user_id) DO UPDATE SET
      reason = EXCLUDED.reason,
      expires_at = GREATEST(public.account_quarantine.expires_at, EXCLUDED.expires_at),
      released_at = NULL;
  END IF;
END;$$;
REVOKE ALL ON FUNCTION public.honeytoken_touched(text,text,text,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.honeytoken_touched(text,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.insider_threat_metrics()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _r jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'admin_required'; END IF;
  SELECT jsonb_build_object(
    'high_risk_users', (SELECT count(*) FROM public.security_user_risk_score WHERE score > 70),
    'untrusted_devices_active', (SELECT count(*) FROM public.user_trusted_devices WHERE trusted = false AND last_seen_at > now() - interval '7 days'),
    'jit_pending', (SELECT count(*) FROM public.jit_access_requests WHERE status = 'pending'),
    'jit_active', (SELECT count(*) FROM public.jit_access_requests WHERE status = 'approved' AND expires_at > now()),
    'honeytoken_hits_30d', (SELECT count(*) FROM public.honeytoken_hits WHERE created_at > now() - interval '30 days'),
    'massive_exports_7d', (SELECT count(*) FROM public.export_receipts WHERE is_massive AND created_at > now() - interval '7 days'),
    'quarantined_active', (SELECT count(*) FROM public.account_quarantine WHERE expires_at > now() AND released_at IS NULL),
    'access_review_pending', (SELECT count(*) FROM public.access_review_items i JOIN public.access_review_cycles c ON c.id=i.cycle_id WHERE i.decision IS NULL AND c.status='open'),
    'top_risk_users', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('user_id',user_id,'score',score,'risk_level',risk_level) ORDER BY score DESC), '[]'::jsonb)
      FROM (SELECT * FROM public.security_user_risk_score ORDER BY score DESC LIMIT 10) t
    )
  ) INTO _r;
  RETURN _r;
END;$$;
REVOKE ALL ON FUNCTION public.insider_threat_metrics() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.insider_threat_metrics() TO authenticated;

CREATE OR REPLACE FUNCTION public.access_review_open(_label text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _uid uuid := auth.uid(); _cid uuid;
BEGIN
  IF NOT public.has_role(_uid,'admin') THEN RAISE EXCEPTION 'admin_required'; END IF;
  INSERT INTO public.access_review_cycles (cycle_label, opened_by, due_at)
  VALUES (_label, _uid, now() + interval '90 days') RETURNING id INTO _cid;
  INSERT INTO public.access_review_items (cycle_id, target_user_id, current_role_name)
  SELECT _cid, ur.user_id, ur.role::text FROM public.user_roles ur
  WHERE ur.role::text IN ('admin','gerente');
  RETURN _cid;
END;$$;
REVOKE ALL ON FUNCTION public.access_review_open(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.access_review_open(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.access_review_decide(_item_id uuid, _decision text, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _uid uuid := auth.uid(); _row public.access_review_items;
BEGIN
  IF NOT public.has_role(_uid,'admin') THEN RAISE EXCEPTION 'admin_required'; END IF;
  IF _decision NOT IN ('keep','revoke','downgrade') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  SELECT * INTO _row FROM public.access_review_items WHERE id = _item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _row.target_user_id = _uid THEN RAISE EXCEPTION 'self_review_forbidden'; END IF;
  UPDATE public.access_review_items
     SET decision = _decision, decision_at = now(), decision_notes = _notes, reviewer_id = _uid
   WHERE id = _item_id;
  PERFORM public.audit_log_record('access_review_decision','access_review_items',_item_id::text,
    NULL, jsonb_build_object('decision',_decision,'target',_row.target_user_id), NULL, NULL, NULL);
END;$$;
REVOKE ALL ON FUNCTION public.access_review_decide(uuid,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.access_review_decide(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.honeytokens_seed()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _count integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'admin_required'; END IF;
  INSERT INTO public.municipios (nome, uf, regiao, is_honeytoken)
  SELECT n, 'ZZ', 'INTERNAL', true FROM (VALUES
    ('__HT_Município_Alpha'), ('__HT_Município_Beta'), ('__HT_Município_Gamma')
  ) AS v(n)
  WHERE NOT EXISTS (SELECT 1 FROM public.municipios m WHERE m.nome = v.n);
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN jsonb_build_object('seeded_municipios', _count);
END;$$;
REVOKE ALL ON FUNCTION public.honeytokens_seed() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.honeytokens_seed() TO authenticated;