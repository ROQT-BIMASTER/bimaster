-- Tabelas para Sistema de Relatórios
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  report_type TEXT NOT NULL,
  frequency TEXT NOT NULL, -- daily, weekly, monthly
  filters JSONB,
  recipient_emails TEXT[],
  active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_report_id UUID REFERENCES scheduled_reports ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users NOT NULL,
  report_type TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  file_url TEXT,
  status TEXT NOT NULL DEFAULT 'success', -- success, failed
  filters JSONB
);

-- Tabelas para Dashboard Executivo
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users,
  team_id UUID,
  goal_type TEXT NOT NULL, -- sales, visits, conversion, share
  target_value NUMERIC NOT NULL,
  current_value NUMERIC DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT DEFAULT 'active', -- active, achieved, failed
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  kpi_type TEXT NOT NULL,
  value NUMERIC NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabelas para Sistema de Notificações
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  type TEXT NOT NULL, -- activity_reminder, prospect_inactive, approval_pending, goal_achieved, goal_failed
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  digest_frequency TEXT DEFAULT 'daily', -- daily, weekly, instant
  notification_types JSONB DEFAULT '{"activity_reminder": true, "prospect_inactive": true, "approval_pending": true, "goal_achieved": true, "goal_failed": true}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_user ON scheduled_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_report_history_user ON report_history(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_period ON goals(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_date ON kpi_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_type ON kpi_snapshots(kpi_type);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- RLS Policies
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Policies para scheduled_reports
CREATE POLICY "Users can view their own scheduled reports"
  ON scheduled_reports FOR SELECT
  USING (auth.uid() = user_id OR is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Users can create their own scheduled reports"
  ON scheduled_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduled reports"
  ON scheduled_reports FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduled reports"
  ON scheduled_reports FOR DELETE
  USING (auth.uid() = user_id);

-- Policies para report_history
CREATE POLICY "Users can view their own report history"
  ON report_history FOR SELECT
  USING (auth.uid() = user_id OR is_admin_or_supervisor(auth.uid()));

CREATE POLICY "System can insert report history"
  ON report_history FOR INSERT
  WITH CHECK (true);

-- Policies para goals
CREATE POLICY "Users can view their own goals"
  ON goals FOR SELECT
  USING (auth.uid() = user_id OR is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins and supervisors can create goals"
  ON goals FOR INSERT
  WITH CHECK (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins and supervisors can update goals"
  ON goals FOR UPDATE
  USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Users can update their own goal progress"
  ON goals FOR UPDATE
  USING (auth.uid() = user_id);

-- Policies para kpi_snapshots
CREATE POLICY "Everyone can view KPI snapshots"
  ON kpi_snapshots FOR SELECT
  USING (true);

CREATE POLICY "System can insert KPI snapshots"
  ON kpi_snapshots FOR INSERT
  WITH CHECK (true);

-- Policies para notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Policies para notification_preferences
CREATE POLICY "Users can view their own notification preferences"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences"
  ON notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW
  EXECUTE FUNCTION update_goals_updated_at();

-- Habilitar realtime para notificações
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;