
-- =============================================
-- PILAR 1: Tabelas de Infraestrutura de Segurança
-- =============================================

-- 1. security_incidents
CREATE TABLE public.security_incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_type TEXT NOT NULL CHECK (incident_type IN ('brute_force', 'cross_tenant', 'mass_export', 'suspicious_ip', 'anomalous_hours', 'other')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'mitigated', 'resolved')),
  risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  source_ip INET,
  user_id UUID,
  empresa_id INTEGER,
  auto_action_taken TEXT DEFAULT 'none' CHECK (auto_action_taken IN ('blocked_ip', 'locked_user', 'revoked_session', 'forced_password_reset', 'none')),
  related_events JSONB DEFAULT '[]'::jsonb,
  title TEXT,
  description TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage security_incidents"
  ON public.security_incidents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_security_incidents_status ON public.security_incidents(status);
CREATE INDEX idx_security_incidents_severity ON public.security_incidents(severity);
CREATE INDEX idx_security_incidents_created ON public.security_incidents(created_at DESC);
CREATE INDEX idx_security_incidents_user ON public.security_incidents(user_id);
CREATE INDEX idx_security_incidents_ip ON public.security_incidents(source_ip);

-- 2. security_ip_blocklist
CREATE TABLE public.security_ip_blocklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address INET NOT NULL,
  reason TEXT NOT NULL,
  blocked_by TEXT NOT NULL DEFAULT 'auto' CHECK (blocked_by IN ('auto', 'manual')),
  incident_id UUID REFERENCES public.security_incidents(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.security_ip_blocklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage security_ip_blocklist"
  ON public.security_ip_blocklist FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_ip_blocklist_active ON public.security_ip_blocklist(ip_address) WHERE is_active = true;
CREATE INDEX idx_ip_blocklist_expires ON public.security_ip_blocklist(expires_at) WHERE is_active = true;

-- 3. security_user_risk_score
CREATE TABLE public.security_user_risk_score (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  factors JSONB DEFAULT '{}'::jsonb,
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.security_user_risk_score ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage security_user_risk_score"
  ON public.security_user_risk_score FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_risk_score_user ON public.security_user_risk_score(user_id);
CREATE INDEX idx_risk_score_level ON public.security_user_risk_score(risk_level);
CREATE INDEX idx_risk_score_score ON public.security_user_risk_score(score DESC);

-- Function to check IP blocklist (used by security middleware)
CREATE OR REPLACE FUNCTION public.is_ip_blocked(p_ip INET)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.security_ip_blocklist
    WHERE ip_address = p_ip
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- Trigger for updated_at
CREATE TRIGGER update_security_incidents_updated_at
  BEFORE UPDATE ON public.security_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_security_user_risk_score_updated_at
  BEFORE UPDATE ON public.security_user_risk_score
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
