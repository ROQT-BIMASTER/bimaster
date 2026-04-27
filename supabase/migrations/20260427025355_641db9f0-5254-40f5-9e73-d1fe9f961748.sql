-- 1) Coluna para registrar quando uma ação foi solicitada ao responsável
ALTER TABLE public.processo_tarefa_espelho
  ADD COLUMN IF NOT EXISTS acao_solicitada_em timestamptz,
  ADD COLUMN IF NOT EXISTS acao_solicitada_por uuid;

-- 2) Linha do tempo de auditoria por espelho (para a modal)
CREATE OR REPLACE FUNCTION public.listar_audit_evidencias_espelho(p_espelho_id uuid)
RETURNS TABLE (
  id uuid,
  acao text,
  documento_anterior_label text,
  documento_novo_label text,
  observacao_anterior text,
  observacao_nova text,
  alterado_por_nome text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.acao,
    COALESCE(da.label, da.tipo) AS documento_anterior_label,
    COALESCE(dn.label, dn.tipo) AS documento_novo_label,
    a.observacao_anterior,
    a.observacao_nova,
    COALESCE(pr.nome, pr.email) AS alterado_por_nome,
    a.created_at
  FROM public.processo_evidencia_audit a
  LEFT JOIN public.processo_etapa_documentos da ON da.id = a.documento_anterior_id
  LEFT JOIN public.processo_etapa_documentos dn ON dn.id = a.documento_novo_id
  LEFT JOIN public.profiles pr ON pr.id = a.alterado_por
  WHERE a.espelho_id = p_espelho_id
  ORDER BY a.created_at ASC;
$$;

-- 3) Reenvio em lote: notifica responsáveis e marca espelhos como "Ação solicitada"
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

    IF r.responsavel_id IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, type, title, message, action_url)
      VALUES (
        r.responsavel_id,
        'task_assigned',
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