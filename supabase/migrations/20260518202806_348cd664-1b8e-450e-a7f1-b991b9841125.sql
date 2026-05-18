
-- =========================
-- Preferências de notificação do chat
-- =========================
CREATE TABLE IF NOT EXISTS public.user_chat_preferences (
  user_id uuid PRIMARY KEY,
  som_mensagens boolean NOT NULL DEFAULT true,
  som_mencoes boolean NOT NULL DEFAULT true,
  som_urgentes boolean NOT NULL DEFAULT true,
  horario_silencioso_inicio time,
  horario_silencioso_fim time,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_chat_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_prefs_select_own" ON public.user_chat_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "chat_prefs_insert_own" ON public.user_chat_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "chat_prefs_update_own" ON public.user_chat_preferences
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =========================
-- Permissões de chat (governança de envio urgente)
-- =========================
CREATE TABLE IF NOT EXISTS public.user_chat_permissions (
  user_id uuid PRIMARY KEY,
  pode_enviar_urgente boolean NOT NULL DEFAULT true,
  motivo_restricao text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_chat_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_perms_select_own_or_admin" ON public.user_chat_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));
CREATE POLICY "chat_perms_admin_write" ON public.user_chat_permissions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- =========================
-- RPC: enviar mensagem urgente
-- =========================
CREATE OR REPLACE FUNCTION public.rpc_enviar_mensagem_urgente(
  p_conversa_id uuid,
  p_conteudo text,
  p_motivo text,
  p_responde_a_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_msg_id uuid;
  v_count int;
  v_permitido boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF p_conteudo IS NULL OR length(trim(p_conteudo)) < 1 THEN
    RAISE EXCEPTION 'Conteúdo obrigatório';
  END IF;

  IF p_motivo IS NULL OR length(trim(p_motivo)) < 8 THEN
    RAISE EXCEPTION 'Informe o motivo (mínimo 8 caracteres) ao chamar a atenção da equipe.';
  END IF;

  -- Permissão (default true se não há linha)
  SELECT COALESCE(pode_enviar_urgente, true) INTO v_permitido
  FROM public.user_chat_permissions WHERE user_id = v_uid;
  IF v_permitido IS NULL THEN v_permitido := true; END IF;

  IF NOT v_permitido THEN
    RAISE EXCEPTION 'Seu envio de mensagens urgentes foi restringido pelo administrador.';
  END IF;

  -- Precisa ser participante ativo
  IF NOT EXISTS (
    SELECT 1 FROM public.conversas_participantes
     WHERE conversa_id = p_conversa_id AND usuario_id = v_uid AND saiu_em IS NULL
  ) THEN
    RAISE EXCEPTION 'Você não participa desta conversa';
  END IF;

  -- Limite: 3 urgentes por hora por usuário
  SELECT COUNT(*) INTO v_count
  FROM public.mensagens
  WHERE remetente_id = v_uid
    AND tipo = 'urgente'
    AND created_at > now() - interval '1 hour';
  IF v_count >= 3 THEN
    RAISE EXCEPTION 'Limite atingido: máximo de 3 mensagens urgentes por hora.';
  END IF;

  INSERT INTO public.mensagens (
    conversa_id, remetente_id, conteudo, tipo, responde_a_id, metadata
  ) VALUES (
    p_conversa_id, v_uid, p_conteudo, 'urgente', p_responde_a_id,
    jsonb_build_object('urgente', true, 'motivo', p_motivo, 'enviada_em', now())
  )
  RETURNING id INTO v_msg_id;

  RETURN v_msg_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_enviar_mensagem_urgente(uuid, text, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_enviar_mensagem_urgente(uuid, text, text, uuid) TO authenticated;

-- =========================
-- Trigger: notificar participantes quando chega mensagem urgente
-- =========================
CREATE OR REPLACE FUNCTION public.tg_notify_urgent_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remetente_nome text;
  v_conversa_titulo text;
BEGIN
  IF NEW.tipo <> 'urgente' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(nome, email, 'Alguém') INTO v_remetente_nome
  FROM public.profiles WHERE id = NEW.remetente_id;

  SELECT COALESCE(nome, 'conversa') INTO v_conversa_titulo
  FROM public.conversas WHERE id = NEW.conversa_id;

  INSERT INTO public.notifications (user_id, type, title, message, action_url)
  SELECT
    cp.usuario_id,
    'chat_urgent',
    'Mensagem urgente de ' || v_remetente_nome,
    LEFT(COALESCE(NEW.conteudo, ''), 200),
    '/dashboard/chat?conversa=' || NEW.conversa_id::text
  FROM public.conversas_participantes cp
  WHERE cp.conversa_id = NEW.conversa_id
    AND cp.saiu_em IS NULL
    AND cp.usuario_id <> NEW.remetente_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_urgent_message ON public.mensagens;
CREATE TRIGGER trg_notify_urgent_message
  AFTER INSERT ON public.mensagens
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_notify_urgent_message();
