-- Ajuste do trigger: aceita criador_id já preenchido (uso por edge com service role).
CREATE OR REPLACE FUNCTION public.set_projeto_criador_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.criador_id IS NULL THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
    END IF;
    NEW.criador_id := auth.uid();
  END IF;

  IF NEW.status IS NULL THEN NEW.status := 'ativo'; END IF;
  IF NEW.visibilidade IS NULL THEN NEW.visibilidade := 'equipe'; END IF;
  IF NEW.tipo IS NULL OR btrim(NEW.tipo) = '' THEN NEW.tipo := 'generico'; END IF;
  IF NEW.cor IS NULL OR btrim(NEW.cor) = '' THEN NEW.cor := '#6366f1'; END IF;
  IF NEW.icone IS NULL OR btrim(NEW.icone) = '' THEN NEW.icone := 'folder'; END IF;

  RETURN NEW;
END;
$$;

-- RPC interno: materializa a tarefa nativa espelhando o briefing enviado ao RR-Tasks.
CREATE OR REPLACE FUNCTION public.rpc_rrtask_materializar_tarefa(
  _briefing_id uuid,
  _rrtask_page_id text,
  _titulo text,
  _data_prazo date,
  _sku text,
  _user_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anchor uuid;
  v_secao uuid;
  v_tarefa uuid;
  v_rr_prod text;
BEGIN
  -- find-or-create do projeto-âncora (codigo_integracao já é UNIQUE)
  INSERT INTO projetos (nome, tipo, codigo_integracao, criador_id, visibilidade)
  VALUES ('Ruby Rose — Produção (RR-Tasks)', 'rr_tasks', 'rr_tasks_anchor', _user_id, 'equipe')
  ON CONFLICT (codigo_integracao) DO NOTHING;

  SELECT id INTO v_anchor FROM projetos WHERE codigo_integracao = 'rr_tasks_anchor';

  -- find-or-create da seção default
  SELECT id INTO v_secao FROM projeto_secoes
   WHERE projeto_id = v_anchor AND nome = 'RR-Tasks'
   LIMIT 1;
  IF v_secao IS NULL THEN
    INSERT INTO projeto_secoes (projeto_id, nome, ordem)
    VALUES (v_anchor, 'RR-Tasks', 0)
    RETURNING id INTO v_secao;
  END IF;

  -- vínculo com o catálogo (GAP 1)
  IF _sku IS NOT NULL AND length(btrim(_sku)) > 0 THEN
    SELECT notion_page_id INTO v_rr_prod
      FROM rr_produtos
     WHERE sku = _sku
     LIMIT 1;
  END IF;

  -- idempotente por briefing
  SELECT tarefa_id INTO v_tarefa FROM briefings WHERE id = _briefing_id;

  IF v_tarefa IS NOT NULL THEN
    UPDATE projeto_tarefas
       SET titulo = COALESCE(_titulo, titulo),
           data_prazo = COALESCE(_data_prazo, data_prazo),
           rr_produto_notion_id = COALESCE(v_rr_prod, rr_produto_notion_id),
           rrtask_page_id = _rrtask_page_id,
           updated_at = now()
     WHERE id = v_tarefa;
  ELSE
    INSERT INTO projeto_tarefas (
      projeto_id, secao_id, titulo, status, estagio, prioridade, data_prazo,
      rr_produto_notion_id, rrtask_page_id, tem_briefing, criador_id, canal_criacao
    ) VALUES (
      v_anchor, v_secao, COALESCE(_titulo, 'RR-Task'), 'Backlog', 'Briefing', 'media',
      _data_prazo, v_rr_prod, _rrtask_page_id, true, _user_id, 'rrtask'
    ) RETURNING id INTO v_tarefa;

    UPDATE briefings SET tarefa_id = v_tarefa WHERE id = _briefing_id;
  END IF;

  RETURN v_tarefa;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_rrtask_materializar_tarefa(uuid, text, text, date, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_rrtask_materializar_tarefa(uuid, text, text, date, text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_rrtask_materializar_tarefa(uuid, text, text, date, text, uuid) TO service_role;