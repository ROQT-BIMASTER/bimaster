
-- Add key_preview column to track which token was used
ALTER TABLE public.api_security_log ADD COLUMN IF NOT EXISTS key_preview text;

-- Allow service_role to insert (edge functions use service role)
-- The existing SELECT policy already restricts reads to admin/supervisor
CREATE POLICY "Service role can insert security logs"
ON public.api_security_log
FOR INSERT
TO service_role
WITH CHECK (true);

-- Index for common query patterns
CREATE INDEX IF NOT EXISTS idx_api_security_log_created_at ON public.api_security_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_security_log_key_preview ON public.api_security_log (key_preview);
CREATE INDEX IF NOT EXISTS idx_api_security_log_endpoint ON public.api_security_log (endpoint);
