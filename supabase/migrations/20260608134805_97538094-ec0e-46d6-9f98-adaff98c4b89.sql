
CREATE TABLE IF NOT EXISTS public.projeto_tarefa_chat_preferencias (
  user_id uuid NOT NULL,
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  muted boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tarefa_id)
);
CREATE INDEX IF NOT EXISTS idx_ptc_pref_tarefa ON public.projeto_tarefa_chat_preferencias(tarefa_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_tarefa_chat_preferencias TO authenticated;
GRANT ALL ON public.projeto_tarefa_chat_preferencias TO service_role;
ALTER TABLE public.projeto_tarefa_chat_preferencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User manages own task chat preferences" ON public.projeto_tarefa_chat_preferencias;
CREATE POLICY "User manages own task chat preferences"
  ON public.projeto_tarefa_chat_preferencias
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.projeto_tarefa_messages
  ADD COLUMN IF NOT EXISTS anexo_id uuid REFERENCES public.projeto_tarefa_anexos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projeto_tarefa_messages_anexo
  ON public.projeto_tarefa_messages(anexo_id) WHERE anexo_id IS NOT NULL;

DROP FUNCTION IF EXISTS public.rpc_chat_tarefas_do_usuario();
CREATE FUNCTION public.rpc_chat_tarefas_do_usuario()
RETURNS TABLE(
  tarefa_id uuid, projeto_id uuid, projeto_nome text, projeto_cor text,
  parent_tarefa_id uuid, parent_titulo text,
  titulo text, codigo text, status text, is_subtask boolean,
  ultima_mensagem text, ultima_mensagem_em timestamptz,
  ultimo_autor_id uuid, ultimo_autor_nome text,
  nao_lidas integer, mencoes_abertas integer,
  muted boolean, archived boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS ( SELECT auth.uid() AS uid ),
  tarefas_interesse AS (
    SELECT DISTINCT t.id
    FROM public.projeto_tarefas t, me
    WHERE t.excluida_em IS NULL
      AND (
        t.responsavel_id = me.uid OR t.criador_id = me.uid
        OR EXISTS (SELECT 1 FROM public.projeto_tarefa_colaboradores c WHERE c.tarefa_id = t.id AND c.user_id = me.uid)
        OR EXISTS (SELECT 1 FROM public.projeto_tarefa_seguidores s WHERE s.tarefa_id = t.id AND s.user_id = me.uid)
        OR EXISTS (SELECT 1 FROM public.projeto_tarefa_messages m WHERE m.tarefa_id = t.id AND me.uid = ANY(m.mentions))
      )
      AND EXISTS (SELECT 1 FROM public.projeto_tarefa_messages m WHERE m.tarefa_id = t.id)
  ),
  ultima AS (
    SELECT DISTINCT ON (m.tarefa_id) m.tarefa_id, m.conteudo AS texto, m.created_at, m.user_id
    FROM public.projeto_tarefa_messages m
    WHERE m.tarefa_id IN (SELECT id FROM tarefas_interesse)
    ORDER BY m.tarefa_id, m.created_at DESC
  ),
  contagens AS (
    SELECT m.tarefa_id,
      COUNT(*) FILTER (WHERE m.user_id <> (SELECT uid FROM me) AND m.created_at > COALESCE(l.last_read_at, '1970-01-01'::timestamptz))::int AS nao_lidas,
      COUNT(*) FILTER (WHERE m.user_id <> (SELECT uid FROM me) AND m.created_at > COALESCE(l.last_read_at, '1970-01-01'::timestamptz) AND (SELECT uid FROM me) = ANY(m.mentions))::int AS mencoes
    FROM public.projeto_tarefa_messages m
    LEFT JOIN public.projeto_tarefa_chat_leituras l ON l.tarefa_id = m.tarefa_id AND l.user_id = (SELECT uid FROM me)
    WHERE m.tarefa_id IN (SELECT id FROM tarefas_interesse)
    GROUP BY m.tarefa_id, l.last_read_at
  )
  SELECT t.id, t.projeto_id, p.nome, p.cor, t.parent_tarefa_id, pt.titulo,
    t.titulo, t.codigo, t.status, COALESCE(t.is_subtask, false),
    u.texto, u.created_at, u.user_id, pr.nome,
    COALESCE(c.nao_lidas, 0), COALESCE(c.mencoes, 0),
    COALESCE(pref.muted, false), COALESCE(pref.archived, false)
  FROM public.projeto_tarefas t
  JOIN tarefas_interesse ti ON ti.id = t.id
  JOIN public.projetos p ON p.id = t.projeto_id
  LEFT JOIN public.projeto_tarefas pt ON pt.id = t.parent_tarefa_id
  LEFT JOIN ultima u ON u.tarefa_id = t.id
  LEFT JOIN contagens c ON c.tarefa_id = t.id
  LEFT JOIN public.profiles pr ON pr.id = u.user_id
  LEFT JOIN public.projeto_tarefa_chat_preferencias pref
    ON pref.tarefa_id = t.id AND pref.user_id = (SELECT uid FROM me)
  ORDER BY u.created_at DESC NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.notify_task_mentions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_autor_nome TEXT; v_tarefa RECORD; v_projeto_id UUID; v_projeto_nome TEXT;
  v_mentioned UUID; v_url TEXT; v_pref RECORD;
BEGIN
  IF NEW.mentions IS NULL OR array_length(NEW.mentions, 1) IS NULL THEN RETURN NEW; END IF;
  SELECT nome INTO v_autor_nome FROM public.profiles WHERE id = NEW.user_id LIMIT 1;
  SELECT t.id, t.titulo, t.secao_id, t.projeto_id INTO v_tarefa
    FROM public.projeto_tarefas t WHERE t.id = NEW.tarefa_id LIMIT 1;
  v_projeto_id := v_tarefa.projeto_id;
  SELECT p.nome INTO v_projeto_nome FROM public.projetos p WHERE p.id = v_projeto_id LIMIT 1;

  FOREACH v_mentioned IN ARRAY NEW.mentions LOOP
    IF v_mentioned IS NULL OR v_mentioned = NEW.user_id THEN CONTINUE; END IF;
    SELECT muted, archived INTO v_pref
      FROM public.projeto_tarefa_chat_preferencias
      WHERE user_id = v_mentioned AND tarefa_id = NEW.tarefa_id;
    IF COALESCE(v_pref.muted, false) OR COALESCE(v_pref.archived, false) THEN CONTINUE; END IF;
    v_url := CASE WHEN v_projeto_id IS NOT NULL THEN
        '/dashboard/projetos/' || v_projeto_id::text || '?tarefa=' || v_tarefa.id::text || '&comentario=' || NEW.id::text
      ELSE NULL END;
    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    VALUES (v_mentioned, 'task_mention', 'Você foi mencionado em um comentário',
      COALESCE(v_autor_nome, 'Alguém') || ' mencionou você em "' || LEFT(COALESCE(v_tarefa.titulo,''), 60) || '"' ||
        CASE WHEN v_projeto_nome IS NOT NULL THEN ' no projeto ' || v_projeto_nome ELSE '' END,
      v_url);
  END LOOP;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_task_replies()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_autor_nome TEXT; v_tarefa RECORD; v_projeto_nome TEXT; v_url TEXT; r RECORD;
BEGIN
  SELECT nome INTO v_autor_nome FROM public.profiles WHERE id = NEW.user_id LIMIT 1;
  SELECT t.id, t.titulo, t.projeto_id, t.responsavel_id, t.criador_id INTO v_tarefa
    FROM public.projeto_tarefas t WHERE t.id = NEW.tarefa_id LIMIT 1;
  SELECT p.nome INTO v_projeto_nome FROM public.projetos p WHERE p.id = v_tarefa.projeto_id LIMIT 1;
  v_url := '/dashboard/projetos/' || v_tarefa.projeto_id::text
        || '?tarefa=' || v_tarefa.id::text || '&comentario=' || NEW.id::text;
  FOR r IN
    SELECT DISTINCT uid FROM (
      SELECT v_tarefa.responsavel_id AS uid
      UNION SELECT v_tarefa.criador_id
      UNION SELECT user_id FROM public.projeto_tarefa_colaboradores WHERE tarefa_id = NEW.tarefa_id
      UNION SELECT user_id FROM public.projeto_tarefa_seguidores WHERE tarefa_id = NEW.tarefa_id
    ) s
    WHERE uid IS NOT NULL AND uid <> NEW.user_id
      AND NOT (uid = ANY(COALESCE(NEW.mentions, ARRAY[]::uuid[])))
      AND NOT EXISTS (
        SELECT 1 FROM public.projeto_tarefa_chat_preferencias pref
        WHERE pref.user_id = uid AND pref.tarefa_id = NEW.tarefa_id AND (pref.muted OR pref.archived)
      )
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    VALUES (r.uid, 'task_reply', 'Nova mensagem em tarefa',
      COALESCE(v_autor_nome, 'Alguém') || ' respondeu em "' || LEFT(COALESCE(v_tarefa.titulo,''), 60) || '"' ||
        CASE WHEN v_projeto_nome IS NOT NULL THEN ' no projeto ' || v_projeto_nome ELSE '' END,
      v_url);
  END LOOP;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_task_replies ON public.projeto_tarefa_messages;
CREATE TRIGGER trg_notify_task_replies
AFTER INSERT ON public.projeto_tarefa_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_task_replies();
