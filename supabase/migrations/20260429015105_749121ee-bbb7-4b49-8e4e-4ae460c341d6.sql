-- Restringe a política de INSERT em apify_run_log apenas ao service_role
DROP POLICY IF EXISTS "service writes apify run log" ON public.apify_run_log;

CREATE POLICY "service writes apify run log"
  ON public.apify_run_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);