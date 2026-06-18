-- Função SECURITY DEFINER para registrar alerta + notificações
-- quando o Brasil devolve/rejeita um documento da China.
-- Centraliza:
--  1) INSERT em china_doc_alertas (já existe — apenas registra o evento)
--  2) Notifica responsáveis da categoria (china_categoria_responsaveis)
--     e o criador da submissão.
CREATE OR REPLACE FUNCTION public.notificar_devolucao_brasil(
  p_documento_id uuid,
  p_submissao_id uuid,
  p_motivo text,
  p_severidade text DEFAULT 'alta'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alerta_id uuid;
  v_produto_nome text;
  v_tipo_doc text;
  v_user uuid;
  v_motivo_curto text := COALESCE(left(trim(p_motivo), 240), '');
BEGIN
  IF p_submissao_id IS NULL THEN
    RAISE EXCEPTION 'submissao_id é obrigatório';
  END IF;

  SELECT produto_nome INTO v_produto_nome
  FROM public.china_produto_submissoes
  WHERE id = p_submissao_id;

  IF p_documento_id IS NOT NULL THEN
    SELECT tipo_documento INTO v_tipo_doc
    FROM public.china_produto_documentos
    WHERE id = p_documento_id;
  END IF;

  -- 1) Alerta visível na Caixa de Entrada China
  INSERT INTO public.china_doc_alertas (
    submissao_id, documento_id, tipo, severidade, mensagem, sugestao
  ) VALUES (
    p_submissao_id,
    p_documento_id,
    'devolucao_brasil',
    COALESCE(p_severidade, 'alta'),
    'Brasil devolveu o documento' ||
      COALESCE(' "' || v_tipo_doc || '"', '') ||
      CASE WHEN v_motivo_curto = '' THEN '.' ELSE ': ' || v_motivo_curto END,
    jsonb_build_object('acao', 'substituir', 'documento_id', p_documento_id)
  )
  RETURNING id INTO v_alerta_id;

  -- 2) Notifica responsáveis da categoria do tipo + criador da submissão
  FOR v_user IN
    SELECT DISTINCT user_id FROM (
      SELECT user_id FROM public.china_categoria_responsaveis
       WHERE submissao_id = p_submissao_id
      UNION
      SELECT created_by AS user_id
        FROM public.china_produto_submissoes
       WHERE id = p_submissao_id AND created_by IS NOT NULL
    ) u
    WHERE user_id IS NOT NULL
  LOOP
    INSERT INTO public.notificacoes (
      user_id, titulo, mensagem, tipo, referencia_id, referencia_tipo
    ) VALUES (
      v_user,
      'Brasil devolveu um documento',
      'O Brasil solicitou correção em ' ||
        COALESCE(v_tipo_doc, 'um documento') ||
        ' do produto ' || COALESCE(v_produto_nome, '—') ||
        CASE WHEN v_motivo_curto = '' THEN '.' ELSE ': ' || v_motivo_curto END,
      'devolucao_brasil',
      p_submissao_id::text,
      'china_checklist'
    );
  END LOOP;

  RETURN v_alerta_id;
END;
$$;

REVOKE ALL ON FUNCTION public.notificar_devolucao_brasil(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notificar_devolucao_brasil(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notificar_devolucao_brasil(uuid, uuid, text, text) TO service_role;