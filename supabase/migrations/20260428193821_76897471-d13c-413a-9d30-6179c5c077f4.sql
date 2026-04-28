-- Cache negativo + log de runs Apify
ALTER TABLE public.discovery_searches
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS errors jsonb;

CREATE INDEX IF NOT EXISTS idx_discovery_searches_lookup
  ON public.discovery_searches (query_normalized, platform, expires_at DESC);

-- Tabela de auditoria de runs Apify
CREATE TABLE IF NOT EXISTS public.apify_run_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  actor_id text NOT NULL,
  input_summary jsonb,
  status text NOT NULL,
  duration_ms integer,
  items_count integer DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.apify_run_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin reads apify run log"
  ON public.apify_run_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "service writes apify run log"
  ON public.apify_run_log FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_apify_run_log_created
  ON public.apify_run_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apify_run_log_actor_status
  ON public.apify_run_log (actor_id, status, created_at DESC);