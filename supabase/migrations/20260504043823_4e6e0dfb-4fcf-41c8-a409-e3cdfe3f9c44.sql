-- =====================================================================
-- Kanban Aprovações: fundação
-- =====================================================================

-- 1) Extensões em fluxo_aprovacao_etapas
ALTER TABLE public.fluxo_aprovacao_etapas
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'aprovacao',
  ADD COLUMN IF NOT EXISTS pipeline_destino_id uuid REFERENCES public.fluxo_aprovacao_config(id);

ALTER TABLE public.fluxo_aprovacao_etapas
  DROP CONSTRAINT IF EXISTS fae_tipo_chk;
ALTER TABLE public.fluxo_aprovacao_etapas
  ADD CONSTRAINT fae_tipo_chk CHECK (tipo IN ('revisao','aprovacao','encaminhamento'));

-- 2) Extensão em projeto_secoes
ALTER TABLE public.projeto_secoes
  ADD COLUMN IF NOT EXISTS pipeline_aprovacao_id uuid REFERENCES public.fluxo_aprovacao_config(id);

-- 3) Eventos: opcionalmente atrelados a um item
ALTER TABLE public.fluxo_aprovacao_etapa_eventos
  ADD COLUMN IF NOT EXISTS item_id uuid;

-- 4) Tabela principal: itens de aprovação por documento
CREATE TABLE IF NOT EXISTS public.aprovacao_documento_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES public.china_produto_documentos(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES public.fluxo_aprovacao_config(id),
  etapa_atual_id uuid REFERENCES public.fluxo_aprovacao_etapas(id),
  responsavel_atual_id uuid,
  status text NOT NULL DEFAULT 'em_andamento',
  lote_id uuid REFERENCES public.fluxo_aprovacao_instancias(id) ON DELETE SET NULL,
  parent_item_id uuid REFERENCES public.aprovacao_documento_itens(id) ON DELETE SET NULL,
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE CASCADE,
  secao_id uuid REFERENCES public.projeto_secoes(id) ON DELETE SET NULL,
  tarefa_id uuid REFERENCES public.projeto_tarefas(id) ON DELETE SET NULL,
  prazo_em timestamptz,
  comentario_atual text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT adi_status_chk CHECK (status IN ('em_andamento','aprovado','rejeitado','encaminhado','cancelado'))
);

CREATE INDEX IF NOT EXISTS idx_adi_projeto ON public.aprovacao_documento_itens(projeto_id);
CREATE INDEX IF NOT EXISTS idx_adi_secao ON public.aprovacao_documento_itens(secao_id);
CREATE INDEX IF NOT EXISTS idx_adi_tarefa ON public.aprovacao_documento_itens(tarefa_id);
CREATE INDEX IF NOT EXISTS idx_adi_responsavel ON public.aprovacao_documento_itens(responsavel_atual_id) WHERE status = 'em_andamento';
CREATE INDEX IF NOT EXISTS idx_adi_lote ON public.aprovacao_documento_itens(lote_id);
CREATE INDEX IF NOT EXISTS idx_adi_etapa ON public.aprovacao_documento_itens(etapa_atual_id);

ALTER TABLE public.aprovacao_documento_itens ENABLE ROW LEVEL SECURITY;

-- RLS
DROP POLICY IF EXISTS adi_select ON public.aprovacao_documento_itens;
CREATE POLICY adi_select ON public.aprovacao_documento_itens
  FOR SELECT TO authenticated
  USING (
    responsavel_atual_id = (SELECT auth.uid())
    OR created_by = (SELECT auth.uid())
    OR has_role((SELECT auth.uid()), 'admin'::app_role)
    OR projeto_id IN (SELECT pm.projeto_id FROM public.projeto_membros pm WHERE pm.user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS adi_insert ON public.aprovacao_documento_itens;
CREATE POLICY adi_insert ON public.aprovacao_documento_itens
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND (
      projeto_id IS NULL
      OR projeto_id IN (SELECT pm.projeto_id FROM public.projeto_membros pm WHERE pm.user_id = (SELECT auth.uid()))
      OR has_role((SELECT auth.uid()), 'admin'::app_role)
    )
  );

DROP POLICY IF EXISTS adi_update ON public.aprovacao_documento_itens;
CREATE POLICY adi_update ON public.aprovacao_documento_itens
  FOR UPDATE TO authenticated
  USING (
    responsavel_atual_id = (SELECT auth.uid())
    OR created_by = (SELECT auth.uid())
    OR has_role((SELECT auth.uid()), 'admin'::app_role)
  );

DROP POLICY IF EXISTS adi_delete ON public.aprovacao_documento_itens;
CREATE POLICY adi_delete ON public.aprovacao_documento_itens
  FOR DELETE TO authenticated
  USING (created_by = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'::app_role));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_adi_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_adi_updated_at ON public.aprovacao_documento_itens;
CREATE TRIGGER trg_adi_updated_at BEFORE UPDATE ON public.aprovacao_documento_itens
  FOR EACH ROW EXECUTE FUNCTION public.tg_adi_set_updated_at();

-- =====================================================================
-- RPC: enviar documento para aprovação
-- =====================================================================
CREATE OR REPLACE FUNCTION public.rpc_enviar_documento_aprovacao(
  p_documento_id uuid,
  p_pipeline_id uuid,
  p_tarefa_id uuid DEFAULT NULL,
  p_lote_id uuid DEFAULT NULL,
  p_prazo_em timestamptz DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_etapa public.fluxo_aprovacao_etapas%ROWTYPE;
  v_projeto_id uuid;
  v_secao_id uuid;
  v_item_id uuid;
  v_uid uuid := auth.uid();
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

  INSERT INTO public.aprovacao_documento_itens(
    documento_id, pipeline_id, etapa_atual_id, responsavel_atual_id,
    status, lote_id, projeto_id, secao_id, tarefa_id, prazo_em, created_by
  ) VALUES (
    p_documento_id, p_pipeline_id, v_etapa.id, v_etapa.responsavel_id,
    'em_andamento', p_lote_id, v_projeto_id, v_secao_id, p_tarefa_id, p_prazo_em, v_uid
  ) RETURNING id INTO v_item_id;

  RETURN v_item_id;
END $$;

GRANT EXECUTE ON FUNCTION public.rpc_enviar_documento_aprovacao(uuid,uuid,uuid,uuid,timestamptz) TO authenticated;

-- =====================================================================
-- RPC: avançar item (aprovar / rejeitar / encaminhar)
-- =====================================================================
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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_decisao NOT IN ('aprovado','rejeitado','encaminhado') THEN
    RAISE EXCEPTION 'Decisão inválida';
  END IF;

  SELECT * INTO v_item FROM public.aprovacao_documento_itens WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;

  IF v_item.status <> 'em_andamento' THEN
    RAISE EXCEPTION 'Item já finalizado (%)', v_item.status;
  END IF;

  IF v_item.responsavel_atual_id IS DISTINCT FROM v_uid
     AND NOT has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Usuário não é o responsável atual';
  END IF;

  SELECT * INTO v_etapa_atual FROM public.fluxo_aprovacao_etapas WHERE id = v_item.etapa_atual_id;

  -- Log evento
  INSERT INTO public.fluxo_aprovacao_etapa_eventos(
    instancia_id, item_id, etapa_ordem, etapa_nome, rodada,
    responsavel_id, decisao, decidido_por, comentario, concluido_em
  ) VALUES (
    COALESCE(v_item.lote_id, gen_random_uuid()), -- placeholder se sem lote
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

  -- Encaminhamento: cria item em pipeline destino se etapa for tipo 'encaminhamento'
  IF v_etapa_atual.tipo = 'encaminhamento' AND v_etapa_atual.pipeline_destino_id IS NOT NULL THEN
    SELECT * INTO v_proxima FROM public.fluxo_aprovacao_etapas
      WHERE config_id = v_etapa_atual.pipeline_destino_id AND ativo = true
      ORDER BY ordem ASC LIMIT 1;

    IF FOUND THEN
      INSERT INTO public.aprovacao_documento_itens(
        documento_id, pipeline_id, etapa_atual_id, responsavel_atual_id,
        status, lote_id, parent_item_id, projeto_id, secao_id, tarefa_id, created_by
      ) VALUES (
        v_item.documento_id, v_etapa_atual.pipeline_destino_id, v_proxima.id, v_proxima.responsavel_id,
        'em_andamento', v_item.lote_id, v_item.id, v_item.projeto_id, v_item.secao_id, v_item.tarefa_id, v_uid
      ) RETURNING id INTO v_novo_item;
    END IF;

    UPDATE public.aprovacao_documento_itens
       SET status='encaminhado', comentario_atual=p_comentario, responsavel_atual_id=NULL
     WHERE id = p_item_id;
    RETURN jsonb_build_object('status','encaminhado','novo_item_id', v_novo_item);
  END IF;

  -- Próxima etapa do mesmo pipeline
  SELECT * INTO v_proxima FROM public.fluxo_aprovacao_etapas
    WHERE config_id = v_item.pipeline_id AND ativo = true AND ordem > v_etapa_atual.ordem
    ORDER BY ordem ASC LIMIT 1;

  IF NOT FOUND THEN
    -- Concluído
    UPDATE public.aprovacao_documento_itens
       SET status='aprovado', comentario_atual=p_comentario, responsavel_atual_id=NULL
     WHERE id = p_item_id;
    RETURN jsonb_build_object('status','aprovado');
  END IF;

  UPDATE public.aprovacao_documento_itens
     SET etapa_atual_id = v_proxima.id,
         responsavel_atual_id = v_proxima.responsavel_id,
         comentario_atual = p_comentario
   WHERE id = p_item_id;

  RETURN jsonb_build_object('status','em_andamento','etapa_id', v_proxima.id);
END $$;

GRANT EXECUTE ON FUNCTION public.rpc_avancar_item_aprovacao(uuid,text,text) TO authenticated;

-- =====================================================================
-- RPC: mover item para outra etapa (drag-and-drop)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.rpc_mover_item_kanban(
  p_item_id uuid,
  p_etapa_destino_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item public.aprovacao_documento_itens%ROWTYPE;
  v_etapa public.fluxo_aprovacao_etapas%ROWTYPE;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_item FROM public.aprovacao_documento_itens WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;

  IF v_item.responsavel_atual_id IS DISTINCT FROM v_uid
     AND v_item.created_by IS DISTINCT FROM v_uid
     AND NOT has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT * INTO v_etapa FROM public.fluxo_aprovacao_etapas
   WHERE id = p_etapa_destino_id AND config_id = v_item.pipeline_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Etapa destino inválida'; END IF;

  UPDATE public.aprovacao_documento_itens
     SET etapa_atual_id = v_etapa.id,
         responsavel_atual_id = v_etapa.responsavel_id,
         status = 'em_andamento'
   WHERE id = p_item_id;
END $$;

GRANT EXECUTE ON FUNCTION public.rpc_mover_item_kanban(uuid,uuid) TO authenticated;