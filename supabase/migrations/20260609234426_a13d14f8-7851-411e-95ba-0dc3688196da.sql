
DROP FUNCTION IF EXISTS public.rpc_rrtask_materializar_tarefa(uuid, text, text, date, text, uuid);
DROP FUNCTION IF EXISTS public.rpc_rrtask_materializar_tarefa(uuid, text, text, date, text, uuid, uuid);

CREATE FUNCTION public.rpc_rrtask_materializar_tarefa(
  _briefing_id uuid,
  _rrtask_page_id text,
  _titulo text,
  _data_prazo date,
  _sku text,
  _user_id uuid,
  _responsavel_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projeto uuid;
  v_secao   uuid;
  v_tarefa  uuid;
  v_rr_prod text;
  v_criador uuid := COALESCE(auth.uid(), _user_id);
BEGIN
  -- 1) Âncora rr_tasks (idempotente)
  SELECT id INTO v_projeto
    FROM public.projetos
   WHERE codigo_integracao = 'rr_tasks_anchor'
   LIMIT 1;

  IF v_projeto IS NULL THEN
    INSERT INTO public.projetos (nome, tipo, codigo_integracao, status, criador_id)
    VALUES ('RR Tasks (espelho Notion)', 'rr_tasks', 'rr_tasks_anchor', 'ativo', v_criador)
    RETURNING id INTO v_projeto;
  END IF;

  -- 1b) Seção default da âncora (secao_id é NOT NULL)
  SELECT id INTO v_secao
    FROM public.projeto_secoes
   WHERE projeto_id = v_projeto AND nome = 'RR-Tasks'
   LIMIT 1;

  IF v_secao IS NULL THEN
    INSERT INTO public.projeto_secoes (projeto_id, nome, ordem)
    VALUES (v_projeto, 'RR-Tasks', 0)
    RETURNING id INTO v_secao;
  END IF;

  -- 2) Vínculo ao catálogo (null hoje, trilha existe)
  IF _sku IS NOT NULL AND length(_sku) > 0 THEN
    SELECT notion_page_id INTO v_rr_prod
      FROM public.rr_produtos
     WHERE sku = _sku
     LIMIT 1;
  END IF;

  -- 3) Lookup por rrtask_page_id (NÃO por briefings.tarefa_id)
  SELECT id INTO v_tarefa
    FROM public.projeto_tarefas
   WHERE rrtask_page_id = _rrtask_page_id
   LIMIT 1;

  IF v_tarefa IS NULL THEN
    INSERT INTO public.projeto_tarefas
      (projeto_id, secao_id, titulo, codigo, data_prazo, status, estagio,
       rrtask_page_id, rr_produto_notion_id, criador_id)
    VALUES
      (v_projeto, v_secao, _titulo, _sku, _data_prazo, 'Backlog', 'Briefing',
       _rrtask_page_id, v_rr_prod, _user_id)
    RETURNING id INTO v_tarefa;
  ELSE
    UPDATE public.projeto_tarefas SET
      titulo               = _titulo,
      data_prazo           = _data_prazo,
      rrtask_page_id       = _rrtask_page_id,
      rr_produto_notion_id = COALESCE(v_rr_prod, rr_produto_notion_id),
      updated_at           = now()
    WHERE id = v_tarefa;
  END IF;

  -- 4) Responsável (idempotente)
  IF _responsavel_user_id IS NOT NULL THEN
    INSERT INTO public.projeto_tarefa_responsaveis (tarefa_id, user_id)
    VALUES (v_tarefa, _responsavel_user_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_tarefa;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_rrtask_materializar_tarefa(uuid, text, text, date, text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_rrtask_materializar_tarefa(uuid, text, text, date, text, uuid, uuid) TO service_role;
