-- 1) Coluna de rastreabilidade no anexo de parecer
ALTER TABLE public.china_submissao_parecer_anexos
  ADD COLUMN IF NOT EXISTS promovido_documento_id uuid
    REFERENCES public.china_produto_documentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_china_subm_parecer_anexos_promovido
  ON public.china_submissao_parecer_anexos(promovido_documento_id)
  WHERE promovido_documento_id IS NOT NULL;

-- 2) RPC para promover anexo de parecer ao checklist
CREATE OR REPLACE FUNCTION public.rpc_china_promover_anexo_parecer_ao_checklist(
  p_parecer_id        uuid,
  p_anexo_id          uuid,
  p_tipo_documento    text,
  p_novo_arquivo_path text,
  p_novo_nome_arquivo text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_submissao_id uuid;
  v_anexo_subm   uuid;
  v_promovido    uuid;
  v_doc_id       uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF p_parecer_id IS NULL OR p_anexo_id IS NULL OR p_tipo_documento IS NULL
     OR p_novo_arquivo_path IS NULL OR p_novo_nome_arquivo IS NULL THEN
    RAISE EXCEPTION 'parâmetros obrigatórios ausentes';
  END IF;

  -- Resolve submissao via parecer
  SELECT submissao_id INTO v_submissao_id
  FROM public.china_submissao_pareceres
  WHERE id = p_parecer_id AND deleted_at IS NULL;
  IF v_submissao_id IS NULL THEN
    RAISE EXCEPTION 'parecer não encontrado';
  END IF;

  -- Valida anexo e duplicidade
  SELECT parecer_id, promovido_documento_id
    INTO v_anexo_subm, v_promovido
  FROM public.china_submissao_parecer_anexos
  WHERE id = p_anexo_id;
  IF v_anexo_subm IS NULL THEN
    RAISE EXCEPTION 'anexo não encontrado';
  END IF;
  IF v_anexo_subm <> p_parecer_id THEN
    RAISE EXCEPTION 'anexo não pertence ao parecer informado';
  END IF;
  IF v_promovido IS NOT NULL THEN
    RAISE EXCEPTION 'anexo já promovido ao checklist';
  END IF;

  -- Cria item oficial do checklist
  INSERT INTO public.china_produto_documentos (
    submissao_id, tipo_documento, arquivo_path, nome_arquivo, status
  ) VALUES (
    v_submissao_id, p_tipo_documento, p_novo_arquivo_path, p_novo_nome_arquivo, 'enviado'
  )
  RETURNING id INTO v_doc_id;

  -- Marca anexo origem como promovido
  UPDATE public.china_submissao_parecer_anexos
     SET promovido_documento_id = v_doc_id
   WHERE id = p_anexo_id;

  RETURN v_doc_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_china_promover_anexo_parecer_ao_checklist(uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_china_promover_anexo_parecer_ao_checklist(uuid, uuid, text, text, text) TO authenticated;