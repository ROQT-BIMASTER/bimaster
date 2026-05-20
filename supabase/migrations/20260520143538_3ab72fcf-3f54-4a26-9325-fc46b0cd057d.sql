
CREATE TABLE IF NOT EXISTS public.client_version_telemetry (
  user_id UUID NOT NULL PRIMARY KEY,
  app_version TEXT NOT NULL,
  user_agent TEXT,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_version_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own telemetry"
  ON public.client_version_telemetry
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own telemetry"
  ON public.client_version_telemetry
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins read all telemetry"
  ON public.client_version_telemetry
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_client_version_telemetry_version
  ON public.client_version_telemetry (app_version);
CREATE INDEX IF NOT EXISTS idx_client_version_telemetry_last_seen
  ON public.client_version_telemetry (last_seen DESC);
