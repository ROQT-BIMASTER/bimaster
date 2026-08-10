ALTER TABLE public.sync_control_rubysp
  ADD COLUMN IF NOT EXISTS solicitar_clientes_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultima_exec_clientes  timestamptz,
  ADD COLUMN IF NOT EXISTS status_clientes       text,
  ADD COLUMN IF NOT EXISTS mensagem_clientes     text;

CREATE OR REPLACE FUNCTION public.solicitar_sync_rubysp(p_alvo text)
RETURNS timestamp with time zone
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE ts timestamptz := now();
BEGIN
  IF p_alvo = 'contas_pagar' AND NOT public.check_user_access(auth.uid(), 'financeiro') THEN
    RAISE EXCEPTION 'acesso negado: sync financeiro' USING ERRCODE = '42501';
  END IF;

  UPDATE public.sync_control_rubysp SET
    solicitar_pedidos_em      = CASE WHEN p_alvo IN ('pedidos','ambos')      THEN ts ELSE solicitar_pedidos_em      END,
    solicitar_historico_em    = CASE WHEN p_alvo IN ('historico','ambos')    THEN ts ELSE solicitar_historico_em    END,
    solicitar_contas_pagar_em = CASE WHEN p_alvo IN ('contas_pagar','ambos') THEN ts ELSE solicitar_contas_pagar_em END,
    solicitar_clientes_em     = CASE WHEN p_alvo = 'clientes'                THEN ts ELSE solicitar_clientes_em     END,
    updated_at = ts
  WHERE id = 1;

  RETURN ts;
END;
$function$;

SELECT cron.unschedule(jobid) FROM cron.job WHERE command ILIKE '%sync-erp-clientes%';