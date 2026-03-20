-- FIX6: Rate limiting table and RPC function
CREATE TABLE IF NOT EXISTS api_rate_limit (
  chave TEXT NOT NULL,
  janela TIMESTAMPTZ NOT NULL DEFAULT date_trunc('minute', now()),
  contador INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (chave, janela)
);

ALTER TABLE api_rate_limit ENABLE ROW LEVEL SECURITY;

-- Service role only (Edge Functions use service_role_key)
CREATE POLICY "service_role_full_access" ON api_rate_limit
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_rate_limit_chave_janela ON api_rate_limit(chave, janela);

-- RPC function for atomic check-and-increment
CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(p_chave TEXT, p_limite INTEGER)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contador INTEGER;
BEGIN
  INSERT INTO api_rate_limit (chave, janela, contador)
  VALUES (p_chave, date_trunc('minute', now()), 1)
  ON CONFLICT (chave, janela) DO UPDATE SET contador = api_rate_limit.contador + 1
  RETURNING contador INTO v_contador;
  
  RETURN v_contador <= p_limite;
END;
$$;

-- FIX7: API Key rotation columns on erp_config
ALTER TABLE erp_config ADD COLUMN IF NOT EXISTS api_key_anterior TEXT;
ALTER TABLE erp_config ADD COLUMN IF NOT EXISTS api_key_expira_em TIMESTAMPTZ;
ALTER TABLE erp_config ADD COLUMN IF NOT EXISTS api_key_anterior_expira_em TIMESTAMPTZ;

-- Cleanup job: delete rate limit entries older than 1 hour (optional, can be called via cron)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM api_rate_limit WHERE janela < now() - interval '1 hour';
$$;