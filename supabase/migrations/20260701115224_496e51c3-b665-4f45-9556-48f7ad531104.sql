-- Auditoria automática de anexos em tarefas/subtarefas
-- Registra INSERT e DELETE de projeto_tarefa_anexos em projeto_tarefa_atividades
-- (quem fez, quando fez, qual arquivo). Aparece automaticamente nos timelines existentes.

CREATE OR REPLACE FUNCTION public.log_projeto_tarefa_anexo_atividade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projeto_id uuid;
  v_parent_id  uuid;
  v_is_subtarefa boolean;
  v_tarefa_id  uuid;
  v_user_id    uuid;
  v_nome       text;
  v_tamanho    bigint;
  v_tipo       text;
  v_descricao  text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_tarefa_id := NEW.tarefa_id;
    v_user_id   := NEW.user_id;
    v_nome      := NEW.nome;
    v_tamanho   := NEW.tamanho;
    v_tipo      := NEW.tipo_arquivo;
  ELSE
    v_tarefa_id := OLD.tarefa_id;
    v_user_id   := COALESCE(auth.uid(), OLD.user_id);
    v_nome      := OLD.nome;
    v_tamanho   := OLD.tamanho;
    v_tipo      := OLD.tipo_arquivo;
  END IF;

  SELECT projeto_id, parent_tarefa_id
    INTO v_projeto_id, v_parent_id
  FROM public.projeto_tarefas
  WHERE id = v_tarefa_id;

  IF v_projeto_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_is_subtarefa := v_parent_id IS NOT NULL;

  IF TG_OP = 'INSERT' THEN
    v_descricao := format(
      'Anexo enviado em %s: %s (%s%s)',
      CASE WHEN v_is_subtarefa THEN 'subtarefa' ELSE 'tarefa' END,
      v_nome,
      COALESCE(v_tipo, 'arquivo'),
      CASE WHEN v_tamanho IS NOT NULL
        THEN ', ' || ROUND(v_tamanho::numeric / 1024, 1)::text || ' KB'
        ELSE '' END
    );
  ELSE
    v_descricao := format(
      'Anexo removido de %s: %s',
      CASE WHEN v_is_subtarefa THEN 'subtarefa' ELSE 'tarefa' END,
      v_nome
    );
  END IF;

  INSERT INTO public.projeto_tarefa_atividades
    (tarefa_id, projeto_id, user_id, tipo, campo, valor_novo, descricao)
  VALUES (
    v_tarefa_id,
    v_projeto_id,
    v_user_id,
    CASE WHEN TG_OP = 'INSERT' THEN 'anexo_adicionado' ELSE 'anexo_removido' END,
    'anexo',
    v_nome,
    v_descricao
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_log_projeto_tarefa_anexo_insert ON public.projeto_tarefa_anexos;
CREATE TRIGGER trg_log_projeto_tarefa_anexo_insert
AFTER INSERT ON public.projeto_tarefa_anexos
FOR EACH ROW
EXECUTE FUNCTION public.log_projeto_tarefa_anexo_atividade();

DROP TRIGGER IF EXISTS trg_log_projeto_tarefa_anexo_delete ON public.projeto_tarefa_anexos;
CREATE TRIGGER trg_log_projeto_tarefa_anexo_delete
AFTER DELETE ON public.projeto_tarefa_anexos
FOR EACH ROW
EXECUTE FUNCTION public.log_projeto_tarefa_anexo_atividade();