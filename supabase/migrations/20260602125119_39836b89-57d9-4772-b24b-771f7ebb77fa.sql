-- Sync participantes of linked conversations (briefing/projeto/submissao)
-- with current members of the underlying entity, so that newly-added
-- members appear in the @-mention picker of the linked chat.

-- 1) Reusable RPC: ensure all current members are participants
CREATE OR REPLACE FUNCTION public.rpc_sync_conversa_vinculada_participantes(p_conversa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo text;
  v_ref uuid;
BEGIN
  SELECT vinculo_tipo, vinculo_id INTO v_tipo, v_ref
    FROM public.conversas WHERE id = p_conversa_id;
  IF v_tipo IS NULL OR v_ref IS NULL THEN RETURN; END IF;

  IF v_tipo = 'projeto' THEN
    INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
    SELECT p_conversa_id, m.user_id, 'membro'
    FROM public.projeto_membros m
    WHERE m.projeto_id = v_ref
    ON CONFLICT (conversa_id, usuario_id) DO NOTHING;
  ELSIF v_tipo = 'briefing' THEN
    INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
    SELECT p_conversa_id, m.user_id, 'membro'
    FROM public.briefing_membros m
    WHERE m.briefing_id = v_ref
    ON CONFLICT (conversa_id, usuario_id) DO NOTHING;
  ELSIF v_tipo = 'submissao' THEN
    INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
    SELECT p_conversa_id, s.created_by, 'membro'
    FROM public.china_produto_submissoes s
    WHERE s.id = v_ref AND s.created_by IS NOT NULL
    ON CONFLICT (conversa_id, usuario_id) DO NOTHING;

    INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
    SELECT p_conversa_id, s.reviewed_by, 'membro'
    FROM public.china_produto_submissoes s
    WHERE s.id = v_ref AND s.reviewed_by IS NOT NULL
    ON CONFLICT (conversa_id, usuario_id) DO NOTHING;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_sync_conversa_vinculada_participantes(uuid) TO authenticated, service_role;

-- 2a) Trigger on projeto_membros: propagate to all linked conversations
CREATE OR REPLACE FUNCTION public.tg_projeto_membros_sync_conversas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
  SELECT c.id, NEW.user_id, 'membro'
  FROM public.conversas c
  WHERE c.vinculo_tipo = 'projeto' AND c.vinculo_id = NEW.projeto_id
  ON CONFLICT (conversa_id, usuario_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projeto_membros_sync_conversas ON public.projeto_membros;
CREATE TRIGGER trg_projeto_membros_sync_conversas
AFTER INSERT ON public.projeto_membros
FOR EACH ROW EXECUTE FUNCTION public.tg_projeto_membros_sync_conversas();

-- 2b) Trigger on briefing_membros
CREATE OR REPLACE FUNCTION public.tg_briefing_membros_sync_conversas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
  SELECT c.id, NEW.user_id, 'membro'
  FROM public.conversas c
  WHERE c.vinculo_tipo = 'briefing' AND c.vinculo_id = NEW.briefing_id
  ON CONFLICT (conversa_id, usuario_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_briefing_membros_sync_conversas ON public.briefing_membros;
CREATE TRIGGER trg_briefing_membros_sync_conversas
AFTER INSERT ON public.briefing_membros
FOR EACH ROW EXECUTE FUNCTION public.tg_briefing_membros_sync_conversas();

-- 2c) Trigger on china_produto_submissoes: when reviewed_by or created_by are set/changed,
-- ensure they are participants of the linked conversation.
CREATE OR REPLACE FUNCTION public.tg_submissao_sync_conversas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
    SELECT c.id, NEW.created_by, 'membro'
    FROM public.conversas c
    WHERE c.vinculo_tipo = 'submissao' AND c.vinculo_id = NEW.id
    ON CONFLICT (conversa_id, usuario_id) DO NOTHING;
  END IF;

  IF NEW.reviewed_by IS NOT NULL THEN
    INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
    SELECT c.id, NEW.reviewed_by, 'membro'
    FROM public.conversas c
    WHERE c.vinculo_tipo = 'submissao' AND c.vinculo_id = NEW.id
    ON CONFLICT (conversa_id, usuario_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_submissao_sync_conversas ON public.china_produto_submissoes;
CREATE TRIGGER trg_submissao_sync_conversas
AFTER INSERT OR UPDATE OF created_by, reviewed_by ON public.china_produto_submissoes
FOR EACH ROW EXECUTE FUNCTION public.tg_submissao_sync_conversas();

-- 3) Backfill: sync all existing linked conversations once
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.conversas WHERE vinculo_tipo IS NOT NULL AND vinculo_id IS NOT NULL
  LOOP
    PERFORM public.rpc_sync_conversa_vinculada_participantes(r.id);
  END LOOP;
END $$;