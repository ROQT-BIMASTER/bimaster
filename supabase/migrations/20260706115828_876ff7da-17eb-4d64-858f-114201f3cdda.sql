
-- RPC: agente pausa SLA de um ticket (aguardando cliente / terceiro)
CREATE OR REPLACE FUNCTION public.rpc_suporte_pausar_sla(p_ticket_id uuid, p_motivo text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fila uuid;
  v_pode boolean;
BEGIN
  SELECT fila_id INTO v_fila FROM public.suporte_tickets WHERE id = p_ticket_id;
  IF v_fila IS NULL THEN RAISE EXCEPTION 'ticket_nao_encontrado'; END IF;

  -- admin ou agente da fila
  SELECT (has_role(auth.uid(), 'admin'::app_role)) OR EXISTS(
    SELECT 1 FROM public.suporte_fila_agentes fa
    WHERE fa.fila_id = v_fila AND fa.user_id = auth.uid() AND coalesce(fa.ativo, true)
  ) INTO v_pode;
  IF NOT v_pode THEN RAISE EXCEPTION 'sem_permissao'; END IF;

  UPDATE public.suporte_tickets
     SET sla_pausado_em = COALESCE(sla_pausado_em, now()),
         sla_status = 'pausado',
         status = CASE WHEN status = 'em_atendimento' THEN 'aguardando_usuario' ELSE status END,
         updated_at = now()
   WHERE id = p_ticket_id;

  INSERT INTO public.suporte_tickets_audit(ticket_id, actor_id, evento, payload, created_at)
  VALUES (p_ticket_id, auth.uid(), 'sla_pausado', jsonb_build_object('motivo', p_motivo), now());
END;
$$;

-- RPC: agente retoma SLA (recalcula prazos)
CREATE OR REPLACE FUNCTION public.rpc_suporte_retomar_sla(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fila uuid;
  v_pode boolean;
BEGIN
  SELECT fila_id INTO v_fila FROM public.suporte_tickets WHERE id = p_ticket_id;
  IF v_fila IS NULL THEN RAISE EXCEPTION 'ticket_nao_encontrado'; END IF;

  SELECT (has_role(auth.uid(), 'admin'::app_role)) OR EXISTS(
    SELECT 1 FROM public.suporte_fila_agentes fa
    WHERE fa.fila_id = v_fila AND fa.user_id = auth.uid() AND coalesce(fa.ativo, true)
  ) INTO v_pode;
  IF NOT v_pode THEN RAISE EXCEPTION 'sem_permissao'; END IF;

  PERFORM public.suporte_retomar_sla(p_ticket_id);

  INSERT INTO public.suporte_tickets_audit(ticket_id, actor_id, evento, payload, created_at)
  VALUES (p_ticket_id, auth.uid(), 'sla_retomado', '{}'::jsonb, now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_suporte_pausar_sla(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_suporte_retomar_sla(uuid) TO authenticated;
