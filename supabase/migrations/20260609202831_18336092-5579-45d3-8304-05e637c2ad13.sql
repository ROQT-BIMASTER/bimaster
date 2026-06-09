-- Substitui índice não-único por garantia hard de unicidade por página Notion
DROP INDEX IF EXISTS public.idx_projeto_tarefas_rrtask_page;

CREATE UNIQUE INDEX IF NOT EXISTS uq_projeto_tarefas_rrtask_page
  ON public.projeto_tarefas (rrtask_page_id)
  WHERE rrtask_page_id IS NOT NULL;

-- RPC: lookup por rrtask_page_id (não mais por briefings.tarefa_id)
CREATE OR REPLACE FUNCTION public.rpc_rrtask_materializar_tarefa(
  _briefing_id uuid,
  _rrtask_page_id text,
  _titulo text,
  _data_prazo date,
  _rr_produto_notion_id text,
  _responsavel_user_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_projeto uuid;
  v_tarefa  uuid;
BEGIN
  -- 1) Âncora rr_tasks (idempotente)
  SELECT id INTO v_projeto
    FROM public.projetos
   WHERE codigo_integracao = 'rr_tasks_anchor'
   LIMIT 1;

  IF v_projeto IS NULL THEN
    INSERT INTO public.projetos (nome, tipo, codigo_integracao, status, criado_por)
    VALUES ('RR Tasks (espelho Notion)', 'rr_tasks', 'rr_tasks_anchor', 'ativo', auth.uid())
    RETURNING id INTO v_projeto;
  END IF;

  -- 2) Lookup por rrtask_page_id (NÃO por briefings.tarefa_id)
  SELECT id INTO v_tarefa
    FROM public.projeto_tarefas
   WHERE rrtask_page_id = _rrtask_page_id
   LIMIT 1;

  IF v_tarefa IS NOT NULL THEN
    -- Ramo UPDATE: só conteúdo. Status/estagio permanecem (mirror é dono).
    UPDATE public.projeto_tarefas
       SET titulo                = COALESCE(_titulo, titulo),
           data_prazo            = COALESCE(_data_prazo, data_prazo),
           rr_produto_notion_id  = COALESCE(_rr_produto_notion_id, rr_produto_notion_id),
           rrtask_page_id        = _rrtask_page_id,
           updated_at            = now()
     WHERE id = v_tarefa;
  ELSE
    -- Ramo INSERT: primeira materialização
    INSERT INTO public.projeto_tarefas (
      projeto_id, titulo, status, estagio, data_prazo,
      rrtask_page_id, rr_produto_notion_id, criado_por
    ) VALUES (
      v_projeto, _titulo, 'Backlog', 'Briefing', _data_prazo,
      _rrtask_page_id, _rr_produto_notion_id, auth.uid()
    ) RETURNING id INTO v_tarefa;
  END IF;

  -- 3) Responsável (best-effort, idempotente)
  IF _responsavel_user_id IS NOT NULL THEN
    INSERT INTO public.projeto_tarefa_responsaveis (tarefa_id, user_id, papel)
    VALUES (v_tarefa, _responsavel_user_id, 'responsavel')
    ON CONFLICT DO NOTHING;
  END IF;

  -- 4) IMPORTANTE: NÃO escrever briefings.tarefa_id — vínculo agora é via rrtask_page_id
  RETURN v_tarefa;
END;
$$;