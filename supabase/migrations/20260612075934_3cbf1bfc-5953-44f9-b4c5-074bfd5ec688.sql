
-- FIX 1: RLS policies aceitando lotes sem tarefa
DROP POLICY IF EXISTS "faee_select" ON public.fluxo_aprovacao_etapa_eventos;
CREATE POLICY "faee_select" ON public.fluxo_aprovacao_etapa_eventos
  FOR SELECT TO authenticated
  USING (
    responsavel_id = (select auth.uid())
    OR decidido_por = (select auth.uid())
    OR has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.fluxo_aprovacao_instancias fai
      LEFT JOIN public.projeto_tarefas pt ON pt.id = fai.tarefa_id
      WHERE fai.id = fluxo_aprovacao_etapa_eventos.instancia_id
        AND (
          fai.tarefa_id IS NULL
          OR pt.projeto_id IN (SELECT projeto_id FROM public.projeto_membros WHERE user_id = (select auth.uid()))
        )
    )
  );

DROP POLICY IF EXISTS "falde_select" ON public.fluxo_aprovacao_lote_documentos;
CREATE POLICY "falde_select" ON public.fluxo_aprovacao_lote_documentos
  FOR SELECT TO authenticated
  USING (
    created_by = (select auth.uid())
    OR has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.fluxo_aprovacao_instancias fai
      LEFT JOIN public.projeto_tarefas pt ON pt.id = fai.tarefa_id
      WHERE fai.id = fluxo_aprovacao_lote_documentos.instancia_id
        AND (
          fai.tarefa_id IS NULL
          OR pt.projeto_id IN (SELECT projeto_id FROM public.projeto_membros WHERE user_id = (select auth.uid()))
        )
    )
  );

-- FIX 2: rpc_avancar_etapa_aprovacao usa v_inst.rodada em vez de 1 hardcoded
CREATE OR REPLACE FUNCTION public.rpc_avancar_etapa_aprovacao(p_instancia_id uuid, p_decisao text, p_comentario text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_evento RECORD; v_inst RECORD; v_proxima RECORD; v_anterior RECORD;
  v_uid uuid := auth.uid(); v_nova_rodada int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_decisao NOT IN ('aprovado', 'rejeitado') THEN
    RAISE EXCEPTION 'Decisão inválida'; END IF;

  SELECT * INTO v_inst FROM public.fluxo_aprovacao_instancias
    WHERE id = p_instancia_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote não encontrado'; END IF;

  SELECT * INTO v_evento FROM public.fluxo_aprovacao_etapa_eventos
    WHERE instancia_id = p_instancia_id AND decisao = 'pendente'
    ORDER BY entrou_em DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nenhuma etapa pendente'; END IF;

  IF v_evento.responsavel_id <> v_uid
     AND NOT has_role(v_uid, 'admin'::app_role)
     AND NOT has_role(v_uid, 'supervisor'::app_role) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  UPDATE public.fluxo_aprovacao_etapa_eventos
  SET decisao = p_decisao, decidido_por = v_uid, comentario = p_comentario,
      concluido_em = now(), assinado_em = now()
  WHERE id = v_evento.id;

  IF p_decisao = 'aprovado' THEN
    SELECT * INTO v_proxima FROM public.fluxo_aprovacao_etapas
      WHERE config_id = v_inst.config_id AND ordem > v_evento.etapa_ordem AND ativo
      ORDER BY ordem ASC LIMIT 1;
    IF FOUND THEN
      INSERT INTO public.fluxo_aprovacao_etapa_eventos
        (instancia_id, etapa_ordem, etapa_nome, rodada, responsavel_id, prazo_em)
      VALUES (p_instancia_id, v_proxima.ordem, v_proxima.nome, v_inst.rodada, v_proxima.responsavel_id,
        CASE WHEN v_proxima.prazo_dias IS NOT NULL
             THEN now() + (v_proxima.prazo_dias || ' days')::interval ELSE NULL END);
      UPDATE public.fluxo_aprovacao_instancias
      SET etapa_atual_ordem = v_proxima.ordem, status = 'pendente', updated_at = now()
      WHERE id = p_instancia_id;
    ELSE
      UPDATE public.fluxo_aprovacao_instancias
      SET status = 'aprovado', updated_at = now() WHERE id = p_instancia_id;
    END IF;
  ELSE
    SELECT * INTO v_anterior FROM public.fluxo_aprovacao_etapas
      WHERE config_id = v_inst.config_id AND ordem < v_evento.etapa_ordem AND ativo
      ORDER BY ordem DESC LIMIT 1;
    IF NOT FOUND THEN
      SELECT * INTO v_anterior FROM public.fluxo_aprovacao_etapas
        WHERE config_id = v_inst.config_id AND ativo ORDER BY ordem ASC LIMIT 1;
    END IF;

    SELECT COALESCE(MAX(rodada), 0) + 1 INTO v_nova_rodada
    FROM public.fluxo_aprovacao_etapa_eventos
    WHERE instancia_id = p_instancia_id AND etapa_ordem = v_anterior.ordem;

    INSERT INTO public.fluxo_aprovacao_etapa_eventos
      (instancia_id, etapa_ordem, etapa_nome, rodada, responsavel_id, prazo_em)
    VALUES (p_instancia_id, v_anterior.ordem, v_anterior.nome, v_nova_rodada,
      v_anterior.responsavel_id,
      CASE WHEN v_anterior.prazo_dias IS NOT NULL
           THEN now() + (v_anterior.prazo_dias || ' days')::interval ELSE NULL END);

    UPDATE public.fluxo_aprovacao_instancias
    SET etapa_atual_ordem = v_anterior.ordem, status = 'pendente',
        rodada = v_nova_rodada, updated_at = now()
    WHERE id = p_instancia_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END; $function$;

-- Backfill: eventos pendentes com rodada divergente da instância
UPDATE public.fluxo_aprovacao_etapa_eventos e
SET rodada = i.rodada
FROM public.fluxo_aprovacao_instancias i
WHERE i.id = e.instancia_id AND e.decisao = 'pendente' AND e.rodada <> i.rodada;

-- FIX 3: rpc_criar_lote_aprovacao_b2c popula fluxo_aprovacao_lote_documentos
CREATE OR REPLACE FUNCTION public.rpc_criar_lote_aprovacao_b2c(p_submissao_id uuid, p_config_id uuid, p_lote_nome text, p_brasil_envia_tipos text[], p_prazo_lote date DEFAULT NULL::date, p_politica text DEFAULT 'continuar'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

  -- Popula documentos do lote a partir de china_produto_documentos
  INSERT INTO public.fluxo_aprovacao_lote_documentos (instancia_id, documento_id, ordem, created_by)
  SELECT v_inst_id, d.id,
         ROW_NUMBER() OVER (ORDER BY d.created_at) - 1,
         v_uid
  FROM public.china_produto_documentos d
  WHERE d.submissao_id = p_submissao_id
    AND d.tipo_documento = ANY(p_brasil_envia_tipos)
  ON CONFLICT DO NOTHING;

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
