-- Migration 2: Item F ampliado — substituir referências à tabela inexistente
-- china_submissao_projeto_vinculos pela canônica china_submissao_projetos
-- em rpc_criar_lote_aprovacao_b2c e rpc_criar_lote_aprovacao_china.

CREATE OR REPLACE FUNCTION public.rpc_criar_lote_aprovacao_b2c(
  p_submissao_id uuid,
  p_config_id uuid,
  p_lote_nome text,
  p_brasil_envia_tipos text[],
  p_prazo_lote date DEFAULT NULL::date,
  p_politica text DEFAULT 'continuar'::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_inst_id uuid;
  v_primeira RECORD;
  v_projeto_id uuid;
  v_submissao RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_lote_nome IS NULL OR length(trim(p_lote_nome)) = 0 THEN
    RAISE EXCEPTION 'Nome do lote é obrigatório';
  END IF;
  IF p_brasil_envia_tipos IS NULL OR array_length(p_brasil_envia_tipos, 1) IS NULL THEN
    RAISE EXCEPTION 'Selecione ao menos um item para aprovação';
  END IF;
  IF p_politica NOT IN ('continuar', 'reiniciar_etapa') THEN
    RAISE EXCEPTION 'Política inválida';
  END IF;

  SELECT s.id, s.produto_codigo, s.numero_ordem
    INTO v_submissao
  FROM public.china_produto_submissoes s
  WHERE s.id = p_submissao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submissão não encontrada'; END IF;

  SELECT sp.projeto_id INTO v_projeto_id
  FROM public.china_submissao_projetos sp
  WHERE sp.submissao_id = p_submissao_id
  ORDER BY sp.is_espelho DESC NULLS LAST, sp.created_at DESC
  LIMIT 1;

  IF NOT has_role(v_uid, 'admin'::app_role)
     AND NOT has_role(v_uid, 'supervisor'::app_role)
     AND (v_projeto_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.projeto_membros
        WHERE projeto_id = v_projeto_id AND user_id = v_uid
     ))
  THEN
    RAISE EXCEPTION 'Sem permissão para iniciar aprovação desta submissão';
  END IF;

  INSERT INTO public.fluxo_aprovacao_instancias
    (config_id, submissao_id, projeto_id, lote_nome, prazo_lote,
     politica_movimentacao, etapa_atual_ordem, status, rodada, created_by, titulo, metadata)
  VALUES (p_config_id, p_submissao_id, v_projeto_id, p_lote_nome, p_prazo_lote,
          p_politica, 0, 'pendente', 1, v_uid, p_lote_nome,
          jsonb_build_object('kind', 'b2c', 'brasil_envia_tipos', to_jsonb(p_brasil_envia_tipos)))
  RETURNING id INTO v_inst_id;

  SELECT * INTO v_primeira FROM public.fluxo_aprovacao_etapas
    WHERE config_id = p_config_id AND ativo ORDER BY ordem ASC LIMIT 1;
  IF FOUND THEN
    INSERT INTO public.fluxo_aprovacao_etapa_eventos
      (instancia_id, etapa_ordem, etapa_nome, rodada, responsavel_id, prazo_em)
    VALUES (v_inst_id, v_primeira.ordem, v_primeira.nome, 1, v_primeira.responsavel_id,
      CASE WHEN v_primeira.prazo_dias IS NOT NULL
           THEN now() + (v_primeira.prazo_dias || ' days')::interval ELSE NULL END);
    UPDATE public.fluxo_aprovacao_instancias
    SET etapa_atual_ordem = v_primeira.ordem WHERE id = v_inst_id;
  END IF;

  INSERT INTO public.china_timeline_eventos
    (kind, title, descricao, submissao_id, produto_codigo, actor_id, actor_label, payload, dedupe_key)
  VALUES ('aprovacao_b2c_iniciada',
          'Aprovação interna B→C iniciada',
          format('Lote "%s" iniciado para %s itens', p_lote_nome, array_length(p_brasil_envia_tipos, 1)),
          p_submissao_id, v_submissao.produto_codigo, v_uid, 'sistema',
          jsonb_build_object('instancia_id', v_inst_id, 'config_id', p_config_id,
                             'brasil_envia_tipos', to_jsonb(p_brasil_envia_tipos)),
          'aprov_b2c_init_' || v_inst_id::text);

  RETURN v_inst_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_criar_lote_aprovacao_china(
  p_submissao_id uuid,
  p_config_id uuid,
  p_lote_nome text,
  p_documento_ids uuid[] DEFAULT NULL::uuid[],
  p_prazo_lote date DEFAULT NULL::date,
  p_politica text DEFAULT 'continuar'::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_inst_id uuid;
  v_primeira RECORD;
  v_doc_id uuid;
  v_ordem int := 0;
  v_projeto_id uuid;
  v_submissao RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_lote_nome IS NULL OR length(trim(p_lote_nome)) = 0 THEN
    RAISE EXCEPTION 'Nome do lote é obrigatório';
  END IF;
  IF p_politica NOT IN ('continuar', 'reiniciar_etapa') THEN
    RAISE EXCEPTION 'Política inválida';
  END IF;

  SELECT s.id, s.produto_codigo, s.numero_ordem
    INTO v_submissao
  FROM public.china_produto_submissoes s
  WHERE s.id = p_submissao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submissão não encontrada'; END IF;

  SELECT sp.projeto_id INTO v_projeto_id
  FROM public.china_submissao_projetos sp
  WHERE sp.submissao_id = p_submissao_id
  ORDER BY sp.is_espelho DESC NULLS LAST, sp.created_at DESC
  LIMIT 1;

  IF NOT has_role(v_uid, 'admin'::app_role)
     AND NOT has_role(v_uid, 'supervisor'::app_role)
     AND (v_projeto_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.projeto_membros
        WHERE projeto_id = v_projeto_id AND user_id = v_uid
     ))
  THEN
    RAISE EXCEPTION 'Sem permissão para iniciar aprovação desta submissão';
  END IF;

  INSERT INTO public.fluxo_aprovacao_instancias
    (config_id, submissao_id, projeto_id, lote_nome, prazo_lote,
     politica_movimentacao, etapa_atual_ordem, status, rodada, created_by, titulo)
  VALUES (p_config_id, p_submissao_id, v_projeto_id, p_lote_nome, p_prazo_lote,
          p_politica, 0, 'pendente', 1, v_uid, p_lote_nome)
  RETURNING id INTO v_inst_id;

  IF p_documento_ids IS NOT NULL THEN
    FOREACH v_doc_id IN ARRAY p_documento_ids LOOP
      INSERT INTO public.fluxo_aprovacao_lote_documentos
        (instancia_id, documento_id, ordem, created_by)
      VALUES (v_inst_id, v_doc_id, v_ordem, v_uid)
      ON CONFLICT DO NOTHING;
      v_ordem := v_ordem + 1;
    END LOOP;
  END IF;

  SELECT * INTO v_primeira FROM public.fluxo_aprovacao_etapas
    WHERE config_id = p_config_id AND ativo ORDER BY ordem ASC LIMIT 1;
  IF FOUND THEN
    INSERT INTO public.fluxo_aprovacao_etapa_eventos
      (instancia_id, etapa_ordem, etapa_nome, rodada, responsavel_id, prazo_em)
    VALUES (v_inst_id, v_primeira.ordem, v_primeira.nome, 1, v_primeira.responsavel_id,
      CASE WHEN v_primeira.prazo_dias IS NOT NULL
           THEN now() + (v_primeira.prazo_dias || ' days')::interval ELSE NULL END);
    UPDATE public.fluxo_aprovacao_instancias
    SET etapa_atual_ordem = v_primeira.ordem WHERE id = v_inst_id;
  END IF;

  INSERT INTO public.china_timeline_eventos
    (kind, title, descricao, submissao_id, produto_codigo, actor_id, actor_label, payload, dedupe_key)
  VALUES ('aprovacao_iniciada',
          'Aprovação iniciada',
          format('Lote "%s" iniciado', p_lote_nome),
          p_submissao_id, v_submissao.produto_codigo, v_uid, 'sistema',
          jsonb_build_object('instancia_id', v_inst_id, 'config_id', p_config_id),
          'aprov_init_' || v_inst_id::text);

  RETURN v_inst_id;
END;
$function$;