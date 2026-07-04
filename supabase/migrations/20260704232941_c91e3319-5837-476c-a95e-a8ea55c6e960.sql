ALTER TABLE public.sync_control_rubysp
  ADD COLUMN IF NOT EXISTS solicitar_contas_pagar_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultima_exec_contas_pagar  timestamptz,
  ADD COLUMN IF NOT EXISTS status_contas_pagar       text;

CREATE OR REPLACE FUNCTION public.solicitar_sync_rubysp(p_alvo text)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ts timestamptz := now();
BEGIN
  UPDATE public.sync_control_rubysp SET
    solicitar_pedidos_em      = CASE WHEN p_alvo IN ('pedidos','ambos')      THEN ts ELSE solicitar_pedidos_em      END,
    solicitar_historico_em    = CASE WHEN p_alvo IN ('historico','ambos')    THEN ts ELSE solicitar_historico_em    END,
    solicitar_contas_pagar_em = CASE WHEN p_alvo IN ('contas_pagar','ambos') THEN ts ELSE solicitar_contas_pagar_em END,
    updated_at = ts
  WHERE id = 1;
  RETURN ts;
END $$;

GRANT EXECUTE ON FUNCTION public.solicitar_sync_rubysp(text) TO authenticated;