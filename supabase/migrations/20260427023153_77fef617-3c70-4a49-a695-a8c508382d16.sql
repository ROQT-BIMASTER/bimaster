-- 1. Coluna evidência no espelho
ALTER TABLE public.processo_tarefa_espelho
  ADD COLUMN IF NOT EXISTS evidencia_documento_id UUID REFERENCES public.processo_etapa_documentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evidencia_observacao TEXT;

CREATE INDEX IF NOT EXISTS idx_processo_tarefa_espelho_evidencia
  ON public.processo_tarefa_espelho(evidencia_documento_id);

-- 2. Lista os documentos oficiais (template) de uma etapa, marcando quais
-- já foram registrados como entregues no checklist desta instância.
CREATE OR REPLACE FUNCTION public.listar_docs_oficiais_etapa(
  p_instancia_id UUID,
  p_etapa_id UUID
)
RETURNS TABLE (
  id UUID,
  tipo TEXT,
  label TEXT,
  obrigatorio BOOLEAN,
  entregue BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH chk AS (
    SELECT COALESCE(checklist_status, '{}'::jsonb) AS cs
    FROM public.processo_instancia_etapa_status
    WHERE instancia_id = p_instancia_id AND etapa_id = p_etapa_id
    LIMIT 1
  )
  SELECT
    d.id,
    d.tipo,
    COALESCE(d.label, d.tipo, 'Documento')::text AS label,
    COALESCE(d.obrigatorio, true) AS obrigatorio,
    COALESCE(((SELECT cs FROM chk)->'documentos'->>d.tipo)::boolean, false) AS entregue
  FROM public.processo_etapa_documentos d
  WHERE d.etapa_id = p_etapa_id
  ORDER BY COALESCE(d.obrigatorio, true) DESC, COALESCE(d.ordem, 999), d.label NULLS LAST;
$$;

-- 3. Conclui um espelho registrando o documento oficial como evidência.
-- - Marca o documento como entregue no checklist da etapa
-- - Atualiza o espelho (status concluida + evidência)
-- - Reflete a conclusão na tarefa do projeto vinculada
CREATE OR REPLACE FUNCTION public.concluir_espelho_com_evidencia(
  p_espelho_id UUID,
  p_documento_id UUID,
  p_observacao TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_esp RECORD;
  v_doc RECORD;
  v_status_id UUID;
  v_checklist JSONB;
BEGIN
  SELECT * INTO v_esp FROM public.processo_tarefa_espelho WHERE id = p_espelho_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vínculo não encontrado';
  END IF;

  SELECT * INTO v_doc FROM public.processo_etapa_documentos WHERE id = p_documento_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Documento oficial não encontrado';
  END IF;

  IF v_doc.etapa_id <> v_esp.etapa_id THEN
    RAISE EXCEPTION 'O documento selecionado não pertence à etapa deste vínculo';
  END IF;

  -- Garante linha de status da etapa e atualiza checklist marcando o doc como entregue
  SELECT id, COALESCE(checklist_status, '{}'::jsonb) INTO v_status_id, v_checklist
  FROM public.processo_instancia_etapa_status
  WHERE instancia_id = v_esp.instancia_id AND etapa_id = v_esp.etapa_id
  LIMIT 1;

  IF v_status_id IS NULL THEN
    INSERT INTO public.processo_instancia_etapa_status (instancia_id, etapa_id, status, checklist_status)
    VALUES (v_esp.instancia_id, v_esp.etapa_id, 'em_andamento',
            jsonb_build_object('documentos', jsonb_build_object(v_doc.tipo, true)))
    RETURNING id INTO v_status_id;
  ELSE
    v_checklist := jsonb_set(
      v_checklist,
      ARRAY['documentos', v_doc.tipo],
      to_jsonb(true),
      true
    );
    UPDATE public.processo_instancia_etapa_status
    SET checklist_status = v_checklist, updated_at = now()
    WHERE id = v_status_id;
  END IF;

  -- Atualiza o espelho com a evidência
  UPDATE public.processo_tarefa_espelho
  SET evidencia_documento_id = p_documento_id,
      evidencia_observacao = p_observacao,
      status = 'concluida',
      concluida_em = now(),
      concluida_por = auth.uid(),
      updated_at = now()
  WHERE id = p_espelho_id;

  -- Propaga para a tarefa do projeto
  IF v_esp.projeto_tarefa_id IS NOT NULL THEN
    UPDATE public.projeto_tarefas
    SET status = 'concluida',
        updated_at = now()
    WHERE id = v_esp.projeto_tarefa_id
      AND status <> 'concluida';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'espelho_id', p_espelho_id,
    'documento_id', p_documento_id,
    'documento_tipo', v_doc.tipo
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.listar_docs_oficiais_etapa(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.concluir_espelho_com_evidencia(UUID, UUID, TEXT) TO authenticated;