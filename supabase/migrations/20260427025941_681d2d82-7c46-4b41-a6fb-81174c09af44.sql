-- 1) Função utilitária para checar preferências
CREATE OR REPLACE FUNCTION public.user_accepts_notification(p_user_id uuid, p_type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (notification_types ->> p_type)::boolean
       FROM public.notification_preferences
      WHERE user_id = p_user_id),
    true  -- default opt-in
  );
$$;

-- 2) Atualiza trigger de criação de espelho para respeitar preferência
CREATE OR REPLACE FUNCTION public.trg_notify_responsavel_espelho()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_responsavel uuid;
  v_titulo text;
  v_projeto text;
BEGIN
  IF NEW.projeto_tarefa_id IS NULL OR NEW.exige_documentos = false THEN
    RETURN NEW;
  END IF;

  SELECT t.responsavel_id, t.titulo, p.nome
    INTO v_responsavel, v_titulo, v_projeto
  FROM public.projeto_tarefas t
  LEFT JOIN public.projetos p ON p.id = t.projeto_id
  WHERE t.id = NEW.projeto_tarefa_id;

  IF v_responsavel IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT public.user_accepts_notification(v_responsavel, 'espelho_pendente_sem_doc') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications(user_id, type, title, message, action_url)
  VALUES (
    v_responsavel,
    'espelho_pendente_sem_doc',
    'Tarefa vinculada a um processo',
    'A tarefa "' || COALESCE(v_titulo,'(sem título)') || '" do projeto ' || COALESCE(v_projeto,'') ||
      ' está vinculada a uma etapa do processo. Será necessário selecionar um documento oficial ao concluir.',
    '/dashboard/projetos'
  );

  RETURN NEW;
END;
$$;

-- 3) Atualiza reenviar_alertas para usar tipo "espelho_acao_solicitada" + preferência
CREATE OR REPLACE FUNCTION public.reenviar_alertas_espelhos_pendentes(p_etapa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notificados integer := 0;
  v_marcados integer := 0;
  v_uid uuid := auth.uid();
  r record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  FOR r IN
    SELECT e.id AS espelho_id,
           e.projeto_tarefa_id,
           t.responsavel_id,
           t.titulo,
           p.nome AS projeto_nome
    FROM public.processo_tarefa_espelho e
    LEFT JOIN public.projeto_tarefas t ON t.id = e.projeto_tarefa_id
    LEFT JOIN public.projetos p ON p.id = t.projeto_id
    WHERE e.etapa_id = p_etapa_id
      AND e.status <> 'concluida'
      AND e.exige_documentos = true
      AND e.evidencia_documento_id IS NULL
  LOOP
    UPDATE public.processo_tarefa_espelho
    SET acao_solicitada_em = now(),
        acao_solicitada_por = v_uid
    WHERE id = r.espelho_id;
    v_marcados := v_marcados + 1;

    IF r.responsavel_id IS NOT NULL
       AND public.user_accepts_notification(r.responsavel_id, 'espelho_acao_solicitada') THEN
      INSERT INTO public.notifications(user_id, type, title, message, action_url)
      VALUES (
        r.responsavel_id,
        'espelho_acao_solicitada',
        'Ação solicitada: documento oficial pendente',
        'O gestor solicitou ação na tarefa "' || COALESCE(r.titulo,'(sem título)') ||
          '" do projeto ' || COALESCE(r.projeto_nome,'') ||
          '. Selecione o documento oficial para concluir e atualizar o processo.',
        '/dashboard/projetos'
      );
      v_notificados := v_notificados + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'marcados', v_marcados,
    'notificados', v_notificados
  );
END;
$$;

-- 4) Trigger ao concluir espelho com evidência
CREATE OR REPLACE FUNCTION public.trg_notify_espelho_concluida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_responsavel uuid;
  v_titulo text;
  v_projeto text;
  v_doc_label text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status = 'concluida'
     AND NEW.evidencia_documento_id IS NOT NULL THEN

    SELECT t.responsavel_id, t.titulo, p.nome
      INTO v_responsavel, v_titulo, v_projeto
    FROM public.projeto_tarefas t
    LEFT JOIN public.projetos p ON p.id = t.projeto_id
    WHERE t.id = NEW.projeto_tarefa_id;

    SELECT COALESCE(d.label, d.tipo) INTO v_doc_label
      FROM public.processo_etapa_documentos d
     WHERE d.id = NEW.evidencia_documento_id;

    IF v_responsavel IS NOT NULL
       AND public.user_accepts_notification(v_responsavel, 'espelho_concluida_evidencia') THEN
      INSERT INTO public.notifications(user_id, type, title, message, action_url)
      VALUES (
        v_responsavel,
        'espelho_concluida_evidencia',
        'Tarefa concluída com evidência',
        'A tarefa "' || COALESCE(v_titulo,'(sem título)') || '" do projeto ' ||
          COALESCE(v_projeto,'') || ' foi concluída e o documento "' ||
          COALESCE(v_doc_label,'(documento)') || '" foi registrado como evidência no processo.',
        '/dashboard/projetos'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_espelho_concluida ON public.processo_tarefa_espelho;
CREATE TRIGGER trg_notify_espelho_concluida
  AFTER UPDATE ON public.processo_tarefa_espelho
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_espelho_concluida();