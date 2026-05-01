-- Security Alert Rules: thresholds configuráveis para alertas automáticos
CREATE TABLE IF NOT EXISTS public.security_alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  metric text NOT NULL CHECK (metric IN ('mfa_coverage_pct','waf_shadow_24h','anomalies_24h','anomalies_high_24h','quarantined_active','open_dep_findings','secrets_due_rotation','pentest_score')),
  comparison text NOT NULL CHECK (comparison IN ('lt','lte','gt','gte','eq')),
  threshold numeric NOT NULL,
  severity text NOT NULL DEFAULT 'warn' CHECK (severity IN ('info','warn','high','critical')),
  cooldown_minutes integer NOT NULL DEFAULT 60,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_triggered_at timestamptz
);

ALTER TABLE public.security_alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alert rules admin read" ON public.security_alert_rules
  FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "alert rules admin write" ON public.security_alert_rules
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- Alerts disparados
CREATE TABLE IF NOT EXISTS public.security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid REFERENCES public.security_alert_rules(id) ON DELETE CASCADE,
  rule_key text NOT NULL,
  metric text NOT NULL,
  observed_value numeric NOT NULL,
  threshold numeric NOT NULL,
  severity text NOT NULL,
  message text NOT NULL,
  acknowledged boolean NOT NULL DEFAULT false,
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_created ON public.security_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_unack ON public.security_alerts(created_at DESC) WHERE acknowledged = false;

ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alerts admin read" ON public.security_alerts
  FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "alerts admin update" ON public.security_alerts
  FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- Seed default rules
INSERT INTO public.security_alert_rules (rule_key, name, description, metric, comparison, threshold, severity, cooldown_minutes) VALUES
  ('mfa_coverage_drop', 'Cobertura MFA abaixo do mínimo', 'Dispara quando a cobertura de MFA entre admins/gerentes cai abaixo de 80%', 'mfa_coverage_pct', 'lt', 80, 'high', 360),
  ('waf_shadow_spike', 'Aumento de eventos WAF shadow', 'Dispara quando eventos WAF em shadow mode passam de 500 em 24h', 'waf_shadow_24h', 'gt', 500, 'warn', 120),
  ('anomalies_high', 'Anomalias high+ acima do limite', 'Dispara quando anomalias high/critical em 24h passam de 5', 'anomalies_high_24h', 'gt', 5, 'high', 60),
  ('anomalies_total', 'Volume total de anomalias', 'Dispara quando o total de anomalias em 24h passa de 50', 'anomalies_24h', 'gt', 50, 'warn', 120),
  ('quarantine_active', 'Múltiplas contas em quarentena', 'Dispara quando 3 ou mais contas estão em quarentena ativa', 'quarantined_active', 'gte', 3, 'critical', 30),
  ('cves_open', 'CVEs abertos no projeto', 'Dispara quando há CVEs abertos em dependências', 'open_dep_findings', 'gt', 0, 'warn', 1440),
  ('secrets_overdue', 'Segredos vencidos para rotação', 'Dispara quando há segredos vencidos para rotação', 'secrets_due_rotation', 'gt', 0, 'warn', 1440),
  ('pentest_low', 'Pentest score abaixo de 80%', 'Dispara quando o último pentest score é menor que 80%', 'pentest_score', 'lt', 80, 'high', 720)
ON CONFLICT (rule_key) DO NOTHING;

-- Função de avaliação
CREATE OR REPLACE FUNCTION public.security_evaluate_alerts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metrics jsonb;
  v_rule record;
  v_value numeric;
  v_triggered integer := 0;
  v_skipped integer := 0;
  v_evaluated integer := 0;
  v_anom_high integer;
  v_should_trigger boolean;
BEGIN
  v_metrics := public.security_v2_metrics();

  -- pre-calc anomalies high+ 24h
  SELECT count(*) INTO v_anom_high
  FROM public.anomaly_events
  WHERE created_at > now() - interval '24 hours'
    AND severity IN ('high','critical');

  FOR v_rule IN SELECT * FROM public.security_alert_rules WHERE enabled = true LOOP
    v_evaluated := v_evaluated + 1;

    -- get observed value
    v_value := CASE v_rule.metric
      WHEN 'mfa_coverage_pct' THEN
        CASE WHEN COALESCE((v_metrics->>'mfa_required_users')::numeric, 0) > 0
          THEN ROUND((v_metrics->>'mfa_enrolled')::numeric / (v_metrics->>'mfa_required_users')::numeric * 100)
          ELSE 100 END
      WHEN 'waf_shadow_24h' THEN COALESCE((v_metrics->>'waf_shadow_24h')::numeric, 0)
      WHEN 'anomalies_24h' THEN COALESCE((v_metrics->>'anomalies_24h')::numeric, 0)
      WHEN 'anomalies_high_24h' THEN v_anom_high
      WHEN 'quarantined_active' THEN COALESCE((v_metrics->>'quarantined_active')::numeric, 0)
      WHEN 'open_dep_findings' THEN COALESCE((v_metrics->>'open_dep_findings')::numeric, 0)
      WHEN 'secrets_due_rotation' THEN COALESCE((v_metrics->>'secrets_due_rotation')::numeric, 0)
      WHEN 'pentest_score' THEN COALESCE((v_metrics->>'last_pentest_score')::numeric, 100)
      ELSE NULL
    END;

    IF v_value IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- compare
    v_should_trigger := CASE v_rule.comparison
      WHEN 'lt'  THEN v_value <  v_rule.threshold
      WHEN 'lte' THEN v_value <= v_rule.threshold
      WHEN 'gt'  THEN v_value >  v_rule.threshold
      WHEN 'gte' THEN v_value >= v_rule.threshold
      WHEN 'eq'  THEN v_value =  v_rule.threshold
    END;

    IF NOT v_should_trigger THEN CONTINUE; END IF;

    -- cooldown
    IF v_rule.last_triggered_at IS NOT NULL
       AND v_rule.last_triggered_at > now() - (v_rule.cooldown_minutes || ' minutes')::interval THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.security_alerts (rule_id, rule_key, metric, observed_value, threshold, severity, message)
    VALUES (
      v_rule.id, v_rule.rule_key, v_rule.metric, v_value, v_rule.threshold, v_rule.severity,
      format('%s — observado %s, limite %s %s', v_rule.name, v_value, v_rule.comparison, v_rule.threshold)
    );

    UPDATE public.security_alert_rules SET last_triggered_at = now(), updated_at = now() WHERE id = v_rule.id;

    -- log também em security_audit_log
    INSERT INTO public.security_audit_log (action, severity, metadata)
    VALUES (
      'security_alert_triggered',
      CASE v_rule.severity WHEN 'critical' THEN 'critical' WHEN 'high' THEN 'error' WHEN 'warn' THEN 'warn' ELSE 'info' END,
      jsonb_build_object('rule_key', v_rule.rule_key, 'metric', v_rule.metric, 'observed', v_value, 'threshold', v_rule.threshold)
    );

    v_triggered := v_triggered + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'evaluated_at', now(),
    'rules_evaluated', v_evaluated,
    'alerts_triggered', v_triggered,
    'skipped', v_skipped
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.security_evaluate_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.security_evaluate_alerts() TO service_role;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_security_alert_rules_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_security_alert_rules_updated_at ON public.security_alert_rules;
CREATE TRIGGER trg_security_alert_rules_updated_at
  BEFORE UPDATE ON public.security_alert_rules
  FOR EACH ROW EXECUTE FUNCTION public.tg_security_alert_rules_updated_at();
