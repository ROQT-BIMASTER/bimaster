CREATE TABLE public.domain_fallback_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reason TEXT NOT NULL,
  elapsed_ms INTEGER,
  origin_host TEXT,
  target_host TEXT,
  pathname TEXT,
  user_agent TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_domain_fallback_logs_created_at ON public.domain_fallback_logs (created_at DESC);
CREATE INDEX idx_domain_fallback_logs_reason ON public.domain_fallback_logs (reason);

ALTER TABLE public.domain_fallback_logs ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ler; insert é feito via edge function service-role.
CREATE POLICY "Admins podem ler logs de fallback"
ON public.domain_fallback_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
