-- =============================================================
-- Fase final: Step-up scopes, WAF runtime config, MFA grace, DR
-- =============================================================

-- 1) Escopos de step-up
CREATE TABLE IF NOT EXISTS public.step_up_scopes (
  scope text PRIMARY KEY,
  description text NOT NULL,
  ttl_seconds int NOT NULL DEFAULT 900,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.step_up_scopes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "step_up_scopes_admin_all" ON public.step_up_scopes;
CREATE POLICY "step_up_scopes_admin_all" ON public.step_up_scopes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "step_up_scopes_authenticated_read" ON public.step_up_scopes;
CREATE POLICY "step_up_scopes_authenticated_read" ON public.step_up_scopes
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.step_up_scopes (scope, description, ttl_seconds) VALUES
  ('export.data', 'Exportações em massa (CSV/XLSX/PDF)', 900),
  ('user.management', 'Criar/editar usuários, atribuir roles, impersonation', 900),
  ('finance.sensitive', 'Pagamentos, contas a pagar acima do limite, transferências', 300),
  ('municipios.write', 'Criar/reatribuir municípios', 900)
ON CONFLICT (scope) DO UPDATE SET
  description = EXCLUDED.description,
  ttl_seconds = EXCLUDED.ttl_seconds;

-- 2) WAF runtime config (shadow vs enforce)
CREATE TABLE IF NOT EXISTS public.waf_runtime_config (
  id int PRIMARY KEY DEFAULT 1,
  mode text NOT NULL DEFAULT 'shadow' CHECK (mode IN ('shadow','enforce','off')),
  geo_enabled boolean NOT NULL DEFAULT true,
  bot_signals_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT waf_runtime_singleton CHECK (id = 1)
);

ALTER TABLE public.waf_runtime_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "waf_runtime_admin_all" ON public.waf_runtime_config;
CREATE POLICY "waf_runtime_admin_all" ON public.waf_runtime_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.waf_runtime_config (id, mode) VALUES (1, 'shadow')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.waf_get_mode()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((SELECT mode FROM public.waf_runtime_config WHERE id = 1), 'shadow');
$$;

REVOKE EXECUTE ON FUNCTION public.waf_get_mode() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.waf_get_mode() TO authenticated, service_role;

-- 3) MFA Grace period (7 dias para admin/gerente)
CREATE TABLE IF NOT EXISTS public.mfa_grace_periods (
  user_id uuid PRIMARY KEY,
  grace_started_at timestamptz NOT NULL DEFAULT now(),
  grace_expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  notified_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mfa_grace_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mfa_grace_self_read" ON public.mfa_grace_periods;
CREATE POLICY "mfa_grace_self_read" ON public.mfa_grace_periods
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS "mfa_grace_admin_write" ON public.mfa_grace_periods;
CREATE POLICY "mfa_grace_admin_write" ON public.mfa_grace_periods
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- Função: MFA é enforced para este usuário?
CREATE OR REPLACE FUNCTION public.mfa_is_enforced_for_user(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _required boolean := false;
  _grace_expires timestamptz;
BEGIN
  -- Requerido apenas se tiver role admin OU gerente
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role, 'gerente'::app_role)
  ) INTO _required;

  IF NOT _required THEN
    RETURN false;
  END IF;

  -- Se já está enrolled+verified, não precisa enforce (já cumpre)
  IF EXISTS (
    SELECT 1 FROM public.mfa_enrollments
    WHERE user_id = _user_id AND verified_at IS NOT NULL
  ) THEN
    RETURN false;
  END IF;

  -- Verifica grace period
  SELECT grace_expires_at INTO _grace_expires
  FROM public.mfa_grace_periods
  WHERE user_id = _user_id;

  IF _grace_expires IS NULL THEN
    -- Inicia grace agora; ainda NÃO bloqueia
    INSERT INTO public.mfa_grace_periods (user_id) VALUES (_user_id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN false;
  END IF;

  RETURN now() > _grace_expires;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mfa_is_enforced_for_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mfa_is_enforced_for_user(uuid) TO authenticated, service_role;

-- 4) DR drill log
CREATE TABLE IF NOT EXISTS public.dr_drill_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  rpo_minutes int,
  rto_minutes int,
  scenario text NOT NULL,
  outcome text,
  notes text,
  executed_by uuid
);

ALTER TABLE public.dr_drill_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dr_drill_admin_all" ON public.dr_drill_log;
CREATE POLICY "dr_drill_admin_all" ON public.dr_drill_log
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));