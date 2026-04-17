-- PR-2: Idempotency cache for write financial endpoints
CREATE TABLE IF NOT EXISTS public.api_idempotency_cache (
  idempotency_key TEXT NOT NULL,
  endpoint_path TEXT NOT NULL,
  body_hash TEXT NOT NULL,
  response_status SMALLINT NOT NULL,
  response_body JSONB NOT NULL,
  response_headers JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  PRIMARY KEY (idempotency_key, endpoint_path)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires
  ON public.api_idempotency_cache (expires_at);

ALTER TABLE public.api_idempotency_cache ENABLE ROW LEVEL SECURITY;

-- RLS: apenas service_role acessa (edge functions). Sem policies = nenhum acesso via PostgREST.
COMMENT ON TABLE public.api_idempotency_cache IS
  'PR-2: Cache de idempotência server-side para endpoints de escrita financeira. TTL 24h. Acesso apenas via service_role nas edge functions.';

-- Cleanup function (chamado por cron)
CREATE OR REPLACE FUNCTION public.cleanup_expired_idempotency_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.api_idempotency_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;