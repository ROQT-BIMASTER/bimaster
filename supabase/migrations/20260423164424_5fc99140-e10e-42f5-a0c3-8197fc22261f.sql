-- Lock down api_idempotency_cache: this table is an internal backend cache
-- written/read exclusively by edge functions using the service role key.
-- Service role bypasses RLS, so a deny-by-default posture for anon and
-- authenticated is safe and resolves the "RLS Enabled No Policy" linter.

CREATE POLICY "Deny all client access to idempotency cache"
  ON public.api_idempotency_cache
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);