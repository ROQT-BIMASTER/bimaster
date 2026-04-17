-- PR-6: Rate-limit headers (draft-ietf-httpapi-ratelimit-headers)
-- Adiciona variante v2 da RPC que retorna metadata estruturada (limit, remaining, reset_at)
-- sem alterar a v1 (compat com 50+ Edge Functions).

CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit_v2(
  p_chave text,
  p_limite integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_contador INTEGER;
  v_janela TIMESTAMPTZ;
  v_reset_at BIGINT;
BEGIN
  v_janela := date_trunc('minute', now());

  INSERT INTO api_rate_limit (chave, janela, contador)
  VALUES (p_chave, v_janela, 1)
  ON CONFLICT (chave, janela) DO UPDATE SET contador = api_rate_limit.contador + 1
  RETURNING contador INTO v_contador;

  -- reset_at = início da próxima janela em unix epoch (segundos)
  v_reset_at := EXTRACT(EPOCH FROM (v_janela + INTERVAL '1 minute'))::BIGINT;

  RETURN jsonb_build_object(
    'allowed', v_contador <= p_limite,
    'limit', p_limite,
    'remaining', GREATEST(p_limite - v_contador, 0),
    'reset_at', v_reset_at
  );
END;
$function$;

COMMENT ON FUNCTION public.check_and_increment_rate_limit_v2(text, integer) IS
  'PR-6: RPC v2 que retorna metadata RFC draft-ietf-httpapi-ratelimit-headers ({allowed, limit, remaining, reset_at}). v1 mantida por compatibilidade.';

-- Permitir execução pelos roles usuais
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit_v2(text, integer) TO authenticated, anon, service_role;