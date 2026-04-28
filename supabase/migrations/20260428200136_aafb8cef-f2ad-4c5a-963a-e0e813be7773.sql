ALTER TABLE public.apify_run_log ADD COLUMN IF NOT EXISTS batch_id uuid;
CREATE INDEX IF NOT EXISTS idx_apify_run_log_batch ON public.apify_run_log(batch_id, created_at DESC);