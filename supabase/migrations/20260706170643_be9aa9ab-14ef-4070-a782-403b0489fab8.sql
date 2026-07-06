
-- 1) Adicionar coluna trilha_id na evidência
ALTER TABLE public.suporte_ticket_evidencias
  ADD COLUMN IF NOT EXISTS trilha_id uuid
  REFERENCES public.suporte_ticket_departamentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sup_evid_trilha
  ON public.suporte_ticket_evidencias(trilha_id);

-- 2) Ampliar CHECK de ações para incluir 'export'
ALTER TABLE public.suporte_evidencia_acessos
  DROP CONSTRAINT IF EXISTS suporte_evidencia_acessos_acao_check;
ALTER TABLE public.suporte_evidencia_acessos
  ADD CONSTRAINT suporte_evidencia_acessos_acao_check
  CHECK (acao IN ('download','view','export'));

-- 3) Extender lock guard para proteger trilha_id/parecer_id em travadas
CREATE OR REPLACE FUNCTION public.tg_sup_evid_lock_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.locked_juridico = true AND NEW.locked_juridico = false
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Evidência sob retenção jurídica não pode ser destravada';
  END IF;
  IF OLD.locked_juridico = true AND (
      OLD.storage_path IS DISTINCT FROM NEW.storage_path
      OR OLD.hash_sha256 IS DISTINCT FROM NEW.hash_sha256
      OR OLD.nome_arquivo IS DISTINCT FROM NEW.nome_arquivo
      OR OLD.categoria IS DISTINCT FROM NEW.categoria
      OR OLD.parecer_id IS DISTINCT FROM NEW.parecer_id
      OR OLD.trilha_id IS DISTINCT FROM NEW.trilha_id
  ) THEN
    RAISE EXCEPTION 'Evidência sob retenção jurídica é imutável';
  END IF;
  RETURN NEW;
END;
$$;

-- 4) RPC para vincular evidência a parecer e/ou item da trilha
CREATE OR REPLACE FUNCTION public.rpc_suporte_vincular_evidencia(
  p_evidencia_id uuid,
  p_parecer_id uuid,
  p_trilha_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ticket_id uuid;
  v_uploader uuid;
  v_locked boolean;
  v_fila_id uuid;
  v_owner uuid;
  v_is_admin boolean;
  v_parecer_ticket uuid;
  v_trilha_ticket uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT ticket_id, uploaded_by, locked_juridico
    INTO v_ticket_id, v_uploader, v_locked
    FROM public.suporte_ticket_evidencias
   WHERE id = p_evidencia_id;
  IF v_ticket_id IS NULL THEN RAISE EXCEPTION 'Evidência não encontrada'; END IF;

  SELECT fila_id, owner_id INTO v_fila_id, v_owner
    FROM public.suporte_tickets WHERE id = v_ticket_id;

  v_is_admin := public.has_role(v_uid, 'admin'::app_role);

  IF v_locked AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Evidência sob retenção jurídica: apenas administradores podem alterar vínculos';
  END IF;

  IF NOT (
    v_is_admin
    OR v_uploader = v_uid
    OR v_owner = v_uid
    OR public.is_agente_fila(v_uid, v_fila_id)
    OR public.is_suporte_staff(v_uid)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para vincular esta evidência';
  END IF;

  IF p_parecer_id IS NOT NULL THEN
    SELECT ticket_id INTO v_parecer_ticket
      FROM public.suporte_pareceres WHERE id = p_parecer_id;
    IF v_parecer_ticket IS DISTINCT FROM v_ticket_id THEN
      RAISE EXCEPTION 'Parecer não pertence a este chamado';
    END IF;
  END IF;

  IF p_trilha_id IS NOT NULL THEN
    SELECT ticket_id INTO v_trilha_ticket
      FROM public.suporte_ticket_departamentos WHERE id = p_trilha_id;
    IF v_trilha_ticket IS DISTINCT FROM v_ticket_id THEN
      RAISE EXCEPTION 'Etapa da trilha não pertence a este chamado';
    END IF;
  END IF;

  UPDATE public.suporte_ticket_evidencias
     SET parecer_id = p_parecer_id,
         trilha_id  = p_trilha_id,
         updated_at = now()
   WHERE id = p_evidencia_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_suporte_vincular_evidencia(uuid,uuid,uuid) TO authenticated;
