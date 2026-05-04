
-- 1) Preferências do Kanban por usuário
CREATE TABLE IF NOT EXISTS public.kanban_aprovacoes_preferencias (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pipelines_visiveis uuid[] NOT NULL DEFAULT '{}',
  modo_visao text NOT NULL DEFAULT 'minhas',
  agrupar_por text NOT NULL DEFAULT 'pipeline',
  mostrar_finalizados boolean NOT NULL DEFAULT false,
  ordem_colunas jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kap_modo_chk CHECK (modo_visao IN ('minhas','equipe','coordenacao','todas')),
  CONSTRAINT kap_agrupar_chk CHECK (agrupar_por IN ('pipeline','projeto','prazo'))
);

ALTER TABLE public.kanban_aprovacoes_preferencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kap_self ON public.kanban_aprovacoes_preferencias;
CREATE POLICY kap_self ON public.kanban_aprovacoes_preferencias
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.tg_kap_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_kap_updated_at ON public.kanban_aprovacoes_preferencias;
CREATE TRIGGER trg_kap_updated_at BEFORE UPDATE ON public.kanban_aprovacoes_preferencias
  FOR EACH ROW EXECUTE FUNCTION public.tg_kap_set_updated_at();

-- 2) Overrides de responsável por etapa (definidos pelo solicitante)
CREATE TABLE IF NOT EXISTS public.aprovacao_item_responsavel_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_raiz_id uuid NOT NULL REFERENCES public.aprovacao_documento_itens(id) ON DELETE CASCADE,
  etapa_id uuid NOT NULL REFERENCES public.fluxo_aprovacao_etapas(id) ON DELETE CASCADE,
  responsavel_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_raiz_id, etapa_id)
);
CREATE INDEX IF NOT EXISTS idx_airo_item ON public.aprovacao_item_responsavel_overrides(item_raiz_id);

ALTER TABLE public.aprovacao_item_responsavel_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS airo_select ON public.aprovacao_item_responsavel_overrides;
CREATE POLICY airo_select ON public.aprovacao_item_responsavel_overrides
  FOR SELECT TO authenticated
  USING (item_raiz_id IN (SELECT id FROM public.aprovacao_documento_itens));

DROP POLICY IF EXISTS airo_insert ON public.aprovacao_item_responsavel_overrides;
CREATE POLICY airo_insert ON public.aprovacao_item_responsavel_overrides
  FOR INSERT TO authenticated
  WITH CHECK (item_raiz_id IN (SELECT id FROM public.aprovacao_documento_itens WHERE created_by = (SELECT auth.uid())));

-- 3) Função helper: resolve responsável por etapa (override > template)
CREATE OR REPLACE FUNCTION public.fn_resolver_responsavel_etapa(
  p_item_raiz_id uuid,
  p_etapa_id uuid,
  p_default_responsavel uuid
) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT responsavel_id FROM public.aprovacao_item_responsavel_overrides
      WHERE item_raiz_id = p_item_raiz_id AND etapa_id = p_etapa_id LIMIT 1),
    p_default_responsavel
  )
$$;

-- 4) RPC enviar atualizada (aceita overrides)
CREATE OR REPLACE FUNCTION public.rpc_enviar_documento_aprovacao(
  p_documento_id uuid,
  p_pipeline_id uuid,
  p_tarefa_id uuid DEFAULT NULL,
  p_lote_id uuid DEFAULT NULL,
  p_prazo_em timestamptz DEFAULT NULL,
  p_overrides jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_etapa public.fluxo_aprovacao_etapas%ROWTYPE;
  v_projeto_id uuid;
  v_secao_id uuid;
  v_item_id uuid;
  v_uid uuid := auth.uid();
  v_responsavel uuid;
  v_key text;
  v_val text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_etapa FROM public.fluxo_aprovacao_etapas
   WHERE config_id = p_pipeline_id AND ativo = true
   ORDER BY ordem ASC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pipeline sem etapas ativas'; END IF;

  IF p_tarefa_id IS NOT NULL THEN
    SELECT pt.projeto_id, pt.secao_id INTO v_projeto_id, v_secao_id
      FROM public.projeto_tarefas pt WHERE pt.id = p_tarefa_id;
  END IF;

  -- Aplica override para etapa inicial
  v_responsavel := v_etapa.responsavel_id;
  IF p_overrides IS NOT NULL THEN
    v_val := p_overrides->>(v_etapa.id::text);
    IF v_val IS NOT NULL THEN v_responsavel := v_val::uuid; END IF;
  END IF;

  INSERT INTO public.aprovacao_documento_itens(
    documento_id, pipeline_id, etapa_atual_id, responsavel_atual_id,
    status, lote_id, projeto_id, secao_id, tarefa_id, prazo_em, created_by
  ) VALUES (
    p_documento_id, p_pipeline_id, v_etapa.id, v_responsavel,
    'em_andamento', p_lote_id, v_projeto_id, v_secao_id, p_tarefa_id, p_prazo_em, v_uid
  ) RETURNING id INTO v_item_id;

  -- Persiste todos os overrides (para etapas futuras do mesmo pipeline)
  IF p_overrides IS NOT NULL THEN
    FOR v_key, v_val IN SELECT key, value FROM jsonb_each_text(p_overrides) LOOP
      IF v_val IS NOT NULL AND v_val <> '' THEN
        INSERT INTO public.aprovacao_item_responsavel_overrides(item_raiz_id, etapa_id, responsavel_id)
          VALUES (v_item_id, v_key::uuid, v_val::uuid)
          ON CONFLICT (item_raiz_id, etapa_id) DO UPDATE SET responsavel_id = EXCLUDED.responsavel_id;
      END IF;
    END LOOP;
  END IF;

  RETURN v_item_id;
END $$;

GRANT EXECUTE ON FUNCTION public.rpc_enviar_documento_aprovacao(uuid,uuid,uuid,uuid,timestamptz,jsonb) TO authenticated;

-- 5) RPC avançar atualizada (lê overrides ao mover etapa)
CREATE OR REPLACE FUNCTION public.rpc_avancar_item_aprovacao(
  p_item_id uuid,
  p_decisao text,
  p_comentario text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item public.aprovacao_documento_itens%ROWTYPE;
  v_etapa_atual public.fluxo_aprovacao_etapas%ROWTYPE;
  v_proxima public.fluxo_aprovacao_etapas%ROWTYPE;
  v_novo_item uuid;
  v_uid uuid := auth.uid();
  v_raiz uuid;
  v_responsavel uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_decisao NOT IN ('aprovado','rejeitado','encaminhado') THEN
    RAISE EXCEPTION 'Decisão inválida';
  END IF;

  SELECT * INTO v_item FROM public.aprovacao_documento_itens WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
  IF v_item.status <> 'em_andamento' THEN RAISE EXCEPTION 'Item já finalizado (%)', v_item.status; END IF;

  IF v_item.responsavel_atual_id IS DISTINCT FROM v_uid
     AND NOT has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Usuário não é o responsável atual';
  END IF;

  v_raiz := COALESCE(v_item.parent_item_id, v_item.id);

  SELECT * INTO v_etapa_atual FROM public.fluxo_aprovacao_etapas WHERE id = v_item.etapa_atual_id;

  INSERT INTO public.fluxo_aprovacao_etapa_eventos(
    instancia_id, item_id, etapa_ordem, etapa_nome, rodada,
    responsavel_id, decisao, decidido_por, comentario, concluido_em
  ) VALUES (
    COALESCE(v_item.lote_id, gen_random_uuid()),
    v_item.id, COALESCE(v_etapa_atual.ordem, 0), v_etapa_atual.nome, 1,
    v_item.responsavel_atual_id,
    CASE WHEN p_decisao = 'encaminhado' THEN 'aprovado' ELSE p_decisao END,
    v_uid, p_comentario, now()
  );

  IF p_decisao = 'rejeitado' THEN
    UPDATE public.aprovacao_documento_itens
       SET status='rejeitado', comentario_atual=p_comentario, responsavel_atual_id=NULL
     WHERE id = p_item_id;
    RETURN jsonb_build_object('status','rejeitado');
  END IF;

  IF v_etapa_atual.tipo = 'encaminhamento' AND v_etapa_atual.pipeline_destino_id IS NOT NULL THEN
    SELECT * INTO v_proxima FROM public.fluxo_aprovacao_etapas
      WHERE config_id = v_etapa_atual.pipeline_destino_id AND ativo = true
      ORDER BY ordem ASC LIMIT 1;
    IF FOUND THEN
      v_responsavel := public.fn_resolver_responsavel_etapa(v_raiz, v_proxima.id, v_proxima.responsavel_id);
      INSERT INTO public.aprovacao_documento_itens(
        documento_id, pipeline_id, etapa_atual_id, responsavel_atual_id,
        status, lote_id, parent_item_id, projeto_id, secao_id, tarefa_id, created_by
      ) VALUES (
        v_item.documento_id, v_etapa_atual.pipeline_destino_id, v_proxima.id, v_responsavel,
        'em_andamento', v_item.lote_id, v_item.id, v_item.projeto_id, v_item.secao_id, v_item.tarefa_id, v_uid
      ) RETURNING id INTO v_novo_item;
    END IF;
    UPDATE public.aprovacao_documento_itens
       SET status='encaminhado', comentario_atual=p_comentario, responsavel_atual_id=NULL
     WHERE id = p_item_id;
    RETURN jsonb_build_object('status','encaminhado','novo_item_id', v_novo_item);
  END IF;

  SELECT * INTO v_proxima FROM public.fluxo_aprovacao_etapas
    WHERE config_id = v_item.pipeline_id AND ativo = true AND ordem > v_etapa_atual.ordem
    ORDER BY ordem ASC LIMIT 1;

  IF NOT FOUND THEN
    UPDATE public.aprovacao_documento_itens
       SET status='aprovado', comentario_atual=p_comentario, responsavel_atual_id=NULL
     WHERE id = p_item_id;
    RETURN jsonb_build_object('status','aprovado');
  END IF;

  v_responsavel := public.fn_resolver_responsavel_etapa(v_raiz, v_proxima.id, v_proxima.responsavel_id);

  UPDATE public.aprovacao_documento_itens
     SET etapa_atual_id = v_proxima.id,
         responsavel_atual_id = v_responsavel,
         comentario_atual = p_comentario
   WHERE id = p_item_id;

  RETURN jsonb_build_object('status','em_andamento','etapa_id', v_proxima.id);
END $$;

GRANT EXECUTE ON FUNCTION public.rpc_avancar_item_aprovacao(uuid,text,text) TO authenticated;
