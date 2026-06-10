
-- metric_definitions
CREATE TABLE IF NOT EXISTS public.metric_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_id text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  unit text NOT NULL,
  formatting jsonb NOT NULL DEFAULT '{}'::jsonb,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target numeric,
  lineage jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_version int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  language text NOT NULL DEFAULT 'pt',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.metric_definitions TO authenticated;
GRANT ALL ON public.metric_definitions TO service_role;
ALTER TABLE public.metric_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "metric_definitions_read" ON public.metric_definitions FOR SELECT TO authenticated
  USING (status='published' OR owner_user_id=auth.uid());
CREATE POLICY "metric_definitions_owner_write" ON public.metric_definitions FOR ALL TO authenticated
  USING (owner_user_id=auth.uid()) WITH CHECK (owner_user_id=auth.uid());

CREATE TABLE IF NOT EXISTS public.metric_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_id text NOT NULL REFERENCES public.metric_definitions(metric_id) ON DELETE CASCADE,
  version int NOT NULL,
  definition_snapshot jsonb NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(metric_id, version)
);
GRANT SELECT, INSERT ON public.metric_versions TO authenticated;
GRANT ALL ON public.metric_versions TO service_role;
ALTER TABLE public.metric_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "metric_versions_read" ON public.metric_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.metric_definitions m WHERE m.metric_id=metric_versions.metric_id AND (m.status='published' OR m.owner_user_id=auth.uid())));
CREATE POLICY "metric_versions_insert_owner" ON public.metric_versions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.metric_definitions m WHERE m.metric_id=metric_versions.metric_id AND m.owner_user_id=auth.uid()));

CREATE OR REPLACE FUNCTION public._metric_versions_block_mutations()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'metric_versions is immutable'; END; $$;
DROP TRIGGER IF EXISTS metric_versions_no_update ON public.metric_versions;
CREATE TRIGGER metric_versions_no_update BEFORE UPDATE OR DELETE ON public.metric_versions
  FOR EACH ROW EXECUTE FUNCTION public._metric_versions_block_mutations();

CREATE TABLE IF NOT EXISTS public.metric_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_id text NOT NULL REFERENCES public.metric_definitions(metric_id) ON DELETE CASCADE,
  metric_version int NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  value numeric NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS metric_runs_metric_period_idx ON public.metric_runs(metric_id, period_end DESC);
GRANT SELECT, INSERT ON public.metric_runs TO authenticated;
GRANT ALL ON public.metric_runs TO service_role;
ALTER TABLE public.metric_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "metric_runs_read" ON public.metric_runs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.metric_definitions m WHERE m.metric_id=metric_runs.metric_id AND (m.status='published' OR m.owner_user_id=auth.uid())));

CREATE TABLE IF NOT EXISTS public.report_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('viewer','editor','owner')),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(report_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.report_permissions TO authenticated;
GRANT ALL ON public.report_permissions TO service_role;
ALTER TABLE public.report_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report_permissions_self_read" ON public.report_permissions FOR SELECT TO authenticated
  USING (user_id=auth.uid() OR granted_by=auth.uid());

CREATE TABLE IF NOT EXISTS public.report_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id text UNIQUE NOT NULL,
  title text NOT NULL,
  question text NOT NULL,
  audience text NOT NULL,
  frequency text NOT NULL,
  expected_action text NOT NULL,
  language text NOT NULL DEFAULT 'pt',
  layout_spec_version int NOT NULL DEFAULT 1,
  layout_spec jsonb NOT NULL DEFAULT '{}'::jsonb,
  metric_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.report_definitions TO authenticated;
GRANT ALL ON public.report_definitions TO service_role;
ALTER TABLE public.report_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report_definitions_read_owner_or_perm" ON public.report_definitions FOR SELECT TO authenticated
  USING (owner_user_id=auth.uid()
    OR EXISTS (SELECT 1 FROM public.report_permissions p WHERE p.report_id=report_definitions.report_id AND p.user_id=auth.uid()));
CREATE POLICY "report_definitions_owner_write" ON public.report_definitions FOR ALL TO authenticated
  USING (owner_user_id=auth.uid()) WITH CHECK (owner_user_id=auth.uid());

ALTER TABLE public.report_permissions
  ADD CONSTRAINT report_permissions_report_id_fkey
  FOREIGN KEY (report_id) REFERENCES public.report_definitions(report_id) ON DELETE CASCADE;

CREATE POLICY "report_permissions_owner_grant" ON public.report_permissions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.report_definitions r WHERE r.report_id=report_permissions.report_id AND r.owner_user_id=auth.uid()));

CREATE TABLE IF NOT EXISTS public.report_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id text NOT NULL REFERENCES public.report_definitions(report_id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('preview','publish')),
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  trigger_source text NOT NULL DEFAULT 'manual',
  period_start timestamptz,
  period_end timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','succeeded','failed')),
  metric_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  narrative text,
  errors jsonb,
  latency_ms int,
  alerts_evaluated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS report_runs_report_idx ON public.report_runs(report_id, created_at DESC);
CREATE INDEX IF NOT EXISTS report_runs_pending_alerts_idx ON public.report_runs(alerts_evaluated_at) WHERE alerts_evaluated_at IS NULL;
GRANT SELECT ON public.report_runs TO authenticated;
GRANT ALL ON public.report_runs TO service_role;
ALTER TABLE public.report_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report_runs_read" ON public.report_runs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.report_definitions r WHERE r.report_id=report_runs.report_id
    AND (r.owner_user_id=auth.uid() OR EXISTS (SELECT 1 FROM public.report_permissions p WHERE p.report_id=r.report_id AND p.user_id=auth.uid()))));

CREATE TABLE IF NOT EXISTS public.report_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.report_runs(id) ON DELETE CASCADE,
  format text NOT NULL CHECK (format IN ('html','pdf','markdown','notion_page')),
  storage_path text, uri text, size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.report_artifacts TO authenticated;
GRANT ALL ON public.report_artifacts TO service_role;
ALTER TABLE public.report_artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report_artifacts_read" ON public.report_artifacts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.report_runs ru JOIN public.report_definitions r ON r.report_id=ru.report_id
    WHERE ru.id=report_artifacts.run_id
    AND (r.owner_user_id=auth.uid() OR EXISTS (SELECT 1 FROM public.report_permissions p WHERE p.report_id=r.report_id AND p.user_id=auth.uid()))));

CREATE TABLE IF NOT EXISTS public.report_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.report_runs(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email','slack','notion','webhook')),
  target text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  error text, sent_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.report_deliveries TO authenticated;
GRANT ALL ON public.report_deliveries TO service_role;
ALTER TABLE public.report_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report_deliveries_read" ON public.report_deliveries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.report_runs ru JOIN public.report_definitions r ON r.report_id=ru.report_id
    WHERE ru.id=report_deliveries.run_id AND r.owner_user_id=auth.uid()));

CREATE TABLE IF NOT EXISTS public.report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id text NOT NULL REFERENCES public.report_definitions(report_id) ON DELETE CASCADE,
  cron_spec text NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  enabled boolean NOT NULL DEFAULT true,
  next_run_at timestamptz, last_run_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_schedules TO authenticated;
GRANT ALL ON public.report_schedules TO service_role;
ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report_schedules_owner_rw" ON public.report_schedules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.report_definitions r WHERE r.report_id=report_schedules.report_id AND r.owner_user_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.report_definitions r WHERE r.report_id=report_schedules.report_id AND r.owner_user_id=auth.uid()));

CREATE TABLE IF NOT EXISTS public.report_event_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id text NOT NULL REFERENCES public.report_definitions(report_id) ON DELETE CASCADE,
  event_name text NOT NULL, enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_event_triggers TO authenticated;
GRANT ALL ON public.report_event_triggers TO service_role;
ALTER TABLE public.report_event_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report_event_triggers_owner_rw" ON public.report_event_triggers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.report_definitions r WHERE r.report_id=report_event_triggers.report_id AND r.owner_user_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.report_definitions r WHERE r.report_id=report_event_triggers.report_id AND r.owner_user_id=auth.uid()));

CREATE TABLE IF NOT EXISTS public.report_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.report_runs(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('driver','anomaly','risk','opportunity')),
  payload jsonb NOT NULL, confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.report_insights TO authenticated;
GRANT ALL ON public.report_insights TO service_role;
ALTER TABLE public.report_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report_insights_read" ON public.report_insights FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.report_runs ru JOIN public.report_definitions r ON r.report_id=ru.report_id
    WHERE ru.id=report_insights.run_id
    AND (r.owner_user_id=auth.uid() OR EXISTS (SELECT 1 FROM public.report_permissions p WHERE p.report_id=r.report_id AND p.user_id=auth.uid()))));

CREATE TABLE IF NOT EXISTS public.alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id text REFERENCES public.report_definitions(report_id) ON DELETE CASCADE,
  metric_id text REFERENCES public.metric_definitions(metric_id) ON DELETE CASCADE,
  rule_type text NOT NULL CHECK (rule_type IN ('pct_change_gt','threshold_breach','trend_shift')),
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  channels jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  schedule_based boolean NOT NULL DEFAULT false,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_rules TO authenticated;
GRANT ALL ON public.alert_rules TO service_role;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alert_rules_owner_rw" ON public.alert_rules FOR ALL TO authenticated
  USING (owner_user_id=auth.uid()) WITH CHECK (owner_user_id=auth.uid());

CREATE TABLE IF NOT EXISTS public.alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.alert_rules(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.report_runs(id) ON DELETE CASCADE,
  metric_id text, variation numeric,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(rule_id, run_id)
);
GRANT SELECT, UPDATE ON public.alert_events TO authenticated;
GRANT ALL ON public.alert_events TO service_role;
ALTER TABLE public.alert_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alert_events_read" ON public.alert_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.alert_rules ar WHERE ar.id=alert_events.rule_id AND ar.owner_user_id=auth.uid()));

CREATE TABLE IF NOT EXISTS public.report_task_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.report_runs(id) ON DELETE CASCADE,
  insight_id uuid REFERENCES public.report_insights(id) ON DELETE SET NULL,
  task_id uuid NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.report_task_links TO authenticated;
GRANT ALL ON public.report_task_links TO service_role;
ALTER TABLE public.report_task_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report_task_links_creator_read" ON public.report_task_links FOR SELECT TO authenticated
  USING (created_by=auth.uid());
CREATE POLICY "report_task_links_creator_insert" ON public.report_task_links FOR INSERT TO authenticated
  WITH CHECK (created_by=auth.uid());

CREATE TABLE IF NOT EXISTS public.report_pins (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id text NOT NULL REFERENCES public.report_definitions(report_id) ON DELETE CASCADE,
  pinned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, report_id)
);
GRANT SELECT, INSERT, DELETE ON public.report_pins TO authenticated;
GRANT ALL ON public.report_pins TO service_role;
ALTER TABLE public.report_pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report_pins_self" ON public.report_pins FOR ALL TO authenticated
  USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());

CREATE TABLE IF NOT EXISTS public.report_subscriptions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id text NOT NULL REFERENCES public.report_definitions(report_id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'email',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, report_id, channel)
);
GRANT SELECT, INSERT, DELETE ON public.report_subscriptions TO authenticated;
GRANT ALL ON public.report_subscriptions TO service_role;
ALTER TABLE public.report_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report_subscriptions_self" ON public.report_subscriptions FOR ALL TO authenticated
  USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());

CREATE TABLE IF NOT EXISTS public.report_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id text, metric_id text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  diff jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.report_audit_log TO authenticated;
GRANT ALL ON public.report_audit_log TO service_role;
ALTER TABLE public.report_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report_audit_log_actor_read" ON public.report_audit_log FOR SELECT TO authenticated
  USING (actor_id=auth.uid());

CREATE OR REPLACE FUNCTION public._report_audit_log_block_mutations()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'report_audit_log is append-only'; END; $$;
DROP TRIGGER IF EXISTS report_audit_log_no_update ON public.report_audit_log;
CREATE TRIGGER report_audit_log_no_update BEFORE UPDATE OR DELETE ON public.report_audit_log
  FOR EACH ROW EXECUTE FUNCTION public._report_audit_log_block_mutations();

DROP TRIGGER IF EXISTS metric_definitions_touch ON public.metric_definitions;
CREATE TRIGGER metric_definitions_touch BEFORE UPDATE ON public.metric_definitions
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();
DROP TRIGGER IF EXISTS report_definitions_touch ON public.report_definitions;
CREATE TRIGGER report_definitions_touch BEFORE UPDATE ON public.report_definitions
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();
DROP TRIGGER IF EXISTS report_schedules_touch ON public.report_schedules;
CREATE TRIGGER report_schedules_touch BEFORE UPDATE ON public.report_schedules
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

-- Feature flags (schema: codigo, nome, descricao, ativo)
INSERT INTO public.feature_flags(codigo, nome, descricao, ativo) VALUES
  ('ff_copilot_v2_foundation','Copilot v2 Foundation','Shared RAG/proposals/audit foundation', true),
  ('ff_copilot_v2_central','Central Copilot v2','Migrate Central Copilot to v2', false),
  ('ff_copilot_v2_projeto','Projeto Copilot v2','Migrate Projeto Copilot to v2', false),
  ('ff_copilot_v2_sofia','Sofia v2','Migrate Sofia financial copilot to v2', false),
  ('ff_copilot_v2_estoque','Estoque Copilot v2','Migrate Estoque copilot to v2', false),
  ('ff_copilot_v2_china','China Copilots v2','Migrate China copilots to v2', false),
  ('ff_reports_v1','Reports Catalog v1','Enable modern reports catalog', false),
  ('ff_router_complexity','Complexity Router','Complexity-based model routing with fail-safe', true)
ON CONFLICT (codigo) DO NOTHING;
