-- Tabela para controlar slots de processamento concorrente
CREATE TABLE IF NOT EXISTS public.sync_rate_limiter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_key TEXT NOT NULL UNIQUE,
  locked_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '60 seconds'),
  request_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para limpeza automática de slots expirados
CREATE INDEX idx_rate_limiter_expires ON public.sync_rate_limiter(expires_at);
CREATE INDEX idx_rate_limiter_request ON public.sync_rate_limiter(request_id);

-- RLS: Apenas service_role pode acessar (usado internamente pela edge function)
ALTER TABLE public.sync_rate_limiter ENABLE ROW LEVEL SECURITY;

-- Função para limpar slots expirados automaticamente
CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limiter_slots()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.sync_rate_limiter
  WHERE expires_at < now();
END;
$$;

COMMENT ON TABLE public.sync_rate_limiter IS 'Controla concorrência de sincronizações para evitar sobrecarga do banco';
COMMENT ON FUNCTION public.cleanup_expired_rate_limiter_slots IS 'Remove slots expirados do rate limiter';