
-- Substitui a RPC para receber tipos (tipo_key) em vez de IDs de china_checklist_brasil_china
DROP FUNCTION IF EXISTS public.rpc_criar_lote_aprovacao_b2c(uuid, uuid, text, uuid[], date, text);

CREATE OR REPLACE FUNCTION public.rpc_criar_lote_aprovacao_b2c(
  p_submissao_id uuid,
  p_config_id uuid,
  p_lote_nome text,
  p_brasil_envia_tipos text[],
  p_prazo_lote date DEFAULT NULL,
  p_politica text DEFAULT 'continuar'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- Tenta resolver o projeto vinculado
  SELECT v.projeto_id INTO v_projeto_id
  FROM public.china_submissao_projeto_vinculos v
  WHERE v.submissao_id = p_submissao_id
  ORDER BY v.created_at DESC LIMIT 1;

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
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_criar_lote_aprovacao_b2c(uuid, uuid, text, text[], date, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.rpc_criar_lote_aprovacao_b2c(uuid, uuid, text, text[], date, text) TO authenticated;

-- Atualiza o trigger para aplicar resultado em china_produto_documentos
CREATE OR REPLACE FUNCTION public.fn_china_documento_on_lote_concluido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_produto_codigo text;
  v_kind text;
  v_tipos text[];
BEGIN
  IF NEW.submissao_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  SELECT produto_codigo INTO v_produto_codigo
  FROM public.china_produto_submissoes WHERE id = NEW.submissao_id;

  v_kind := COALESCE(NEW.metadata->>'kind', 'c2b');

  -- Lote B2C: aprova/devolve documentos Brasil → China; não altera status da submissão
  IF v_kind = 'b2c' THEN
    IF NEW.metadata ? 'brasil_envia_tipos' THEN
      SELECT ARRAY(SELECT jsonb_array_elements_text(NEW.metadata->'brasil_envia_tipos'))
        INTO v_tipos;
    ELSE
      v_tipos := ARRAY[]::text[];
    END IF;

    IF NEW.status = 'aprovado' THEN
      IF array_length(v_tipos, 1) IS NOT NULL THEN
        UPDATE public.china_produto_documentos
           SET status = 'aprovado'
         WHERE submissao_id = NEW.submissao_id
           AND tipo_documento = ANY(v_tipos);
      END IF;

      INSERT INTO public.china_timeline_eventos
        (kind, title, descricao, submissao_id, produto_codigo, actor_label, payload, dedupe_key)
      VALUES ('aprovacao_b2c_concluida',
              'Aprovação interna B→C concluída',
              format('Lote "%s" aprovado — itens prontos para envio à China',
                     COALESCE(NEW.lote_nome, NEW.titulo, '')),
              NEW.submissao_id, v_produto_codigo, 'sistema',
              jsonb_build_object('instancia_id', NEW.id, 'brasil_envia_tipos', to_jsonb(v_tipos)),
              'aprov_b2c_done_' || NEW.id::text);

    ELSIF NEW.status = 'rejeitado' THEN
      IF array_length(v_tipos, 1) IS NOT NULL THEN
        UPDATE public.china_produto_documentos
           SET status = 'rejeitado'
         WHERE submissao_id = NEW.submissao_id
           AND tipo_documento = ANY(v_tipos);
      END IF;

      INSERT INTO public.china_timeline_eventos
        (kind, title, descricao, submissao_id, produto_codigo, actor_label, payload, dedupe_key)
      VALUES ('aprovacao_b2c_rejeitada',
              'Aprovação interna B→C rejeitada',
              format('Lote "%s" reprovado — itens voltaram para pendente',
                     COALESCE(NEW.lote_nome, NEW.titulo, '')),
              NEW.submissao_id, v_produto_codigo, 'sistema',
              jsonb_build_object('instancia_id', NEW.id, 'brasil_envia_tipos', to_jsonb(v_tipos)),
              'aprov_b2c_rej_' || NEW.id::text);
    END IF;

    RETURN NEW;
  END IF;

  -- Comportamento original (lote C2B)
  IF NEW.status = 'aprovado' THEN
    UPDATE public.china_produto_submissoes
       SET status = 'aprovado', updated_at = now()
     WHERE id = NEW.submissao_id;

    INSERT INTO public.china_timeline_eventos
      (kind, title, descricao, submissao_id, produto_codigo, actor_label, payload, dedupe_key)
    VALUES ('aprovacao_concluida',
            'Aprovação concluída',
            format('Lote "%s" aprovado', COALESCE(NEW.lote_nome, NEW.titulo, '')),
            NEW.submissao_id, v_produto_codigo, 'sistema',
            jsonb_build_object('instancia_id', NEW.id),
            'aprov_done_' || NEW.id::text);

  ELSIF NEW.status = 'rejeitado' THEN
    UPDATE public.china_produto_submissoes
       SET status = 'ajuste_necessario', updated_at = now()
     WHERE id = NEW.submissao_id;

    INSERT INTO public.china_timeline_eventos
      (kind, title, descricao, submissao_id, produto_codigo, actor_label, payload, dedupe_key)
    VALUES ('aprovacao_rejeitada',
            'Aprovação rejeitada',
            format('Lote "%s" reprovado — devolvido para "A encaminhar"', COALESCE(NEW.lote_nome, NEW.titulo, '')),
            NEW.submissao_id, v_produto_codigo, 'sistema',
            jsonb_build_object('instancia_id', NEW.id),
            'aprov_rej_' || NEW.id::text);
  END IF;

  RETURN NEW;
END;
$$;
