
-- Tabela de rate limiting para proteção DDoS L7
CREATE TABLE public.ddos_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  identifier_type TEXT NOT NULL DEFAULT 'ip',
  request_count INT DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT now(),
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para busca rápida por identificador e janela
CREATE INDEX idx_ddos_identifier ON public.ddos_rate_limits(identifier, window_start);
CREATE INDEX idx_ddos_blocked ON public.ddos_rate_limits(blocked_until) WHERE blocked_until IS NOT NULL;

-- RLS: apenas service_role acessa
ALTER TABLE public.ddos_rate_limits ENABLE ROW LEVEL SECURITY;

-- Função de cleanup automático (registros > 1 hora)
CREATE OR REPLACE FUNCTION public.cleanup_ddos_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.ddos_rate_limits 
  WHERE window_start < now() - interval '1 hour'
    AND (blocked_until IS NULL OR blocked_until < now());
$$;
