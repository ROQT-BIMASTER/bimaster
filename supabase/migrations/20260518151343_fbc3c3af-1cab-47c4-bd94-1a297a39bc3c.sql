
-- Recria o índice de dedup como NÃO-parcial (todos os emits passam referencia_tipo/id)
DROP INDEX IF EXISTS public.uq_inbox_dedup;
CREATE UNIQUE INDEX uq_inbox_dedup
  ON public.inbox_items (user_id, referencia_tipo, referencia_id, tipo);

-- 1) Trigger de atribuição
CREATE OR REPLACE FUNCTION public.trg_inbox_from_projeto_tarefa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projeto_nome text;
  v_acao_url text;
BEGIN
  IF NEW.responsavel_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.responsavel_id IS NOT DISTINCT FROM NEW.responsavel_id THEN
    RETURN NEW;
  END IF;
  IF NEW.status IN ('concluida','cancelada') THEN RETURN NEW; END IF;

  SELECT p.nome INTO v_projeto_nome FROM public.projetos p WHERE p.id = NEW.projeto_id;
  v_acao_url := '/dashboard/projetos/' || NEW.projeto_id::text;

  IF NEW.criador_id IS DISTINCT FROM NEW.responsavel_id THEN
    PERFORM public.inbox_emit(
      NEW.responsavel_id, 'atribuida_a_mim'::inbox_caixa, 'projetos'::inbox_origem,
      'atribuida', 'auto'::inbox_modo_leitura,
      COALESCE(NEW.titulo, 'Tarefa'), NULL, v_acao_url,
      'projeto_tarefa', NEW.id,
      NEW.projeto_id, NULL, NULL, 'projetos',
      NEW.criador_id,
      jsonb_build_object('projeto_nome', v_projeto_nome)
    );

    IF NEW.criador_id IS NOT NULL THEN
      PERFORM public.inbox_emit(
        NEW.criador_id, 'delegada_por_mim'::inbox_caixa, 'projetos'::inbox_origem,
        'delegada', 'auto'::inbox_modo_leitura,
        COALESCE(NEW.titulo, 'Tarefa'), NULL, v_acao_url,
        'projeto_tarefa', NEW.id,
        NEW.projeto_id, NULL, NULL, 'projetos',
        NEW.criador_id,
        jsonb_build_object('projeto_nome', v_projeto_nome, 'responsavel_id', NEW.responsavel_id)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inbox_from_projeto_tarefa_ins ON public.projeto_tarefas;
CREATE TRIGGER trg_inbox_from_projeto_tarefa_ins
  AFTER INSERT ON public.projeto_tarefas
  FOR EACH ROW EXECUTE FUNCTION public.trg_inbox_from_projeto_tarefa();

DROP TRIGGER IF EXISTS trg_inbox_from_projeto_tarefa_upd ON public.projeto_tarefas;
CREATE TRIGGER trg_inbox_from_projeto_tarefa_upd
  AFTER UPDATE OF responsavel_id ON public.projeto_tarefas
  FOR EACH ROW EXECUTE FUNCTION public.trg_inbox_from_projeto_tarefa();

-- 2) Resolver ao fechar
CREATE OR REPLACE FUNCTION public.trg_inbox_resolve_on_tarefa_fechada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('concluida','cancelada')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.inbox_items
       SET resolvido_em = now(), updated_at = now()
     WHERE referencia_tipo = 'projeto_tarefa'
       AND referencia_id = NEW.id
       AND resolvido_em IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inbox_resolve_on_tarefa_fechada ON public.projeto_tarefas;
CREATE TRIGGER trg_inbox_resolve_on_tarefa_fechada
  AFTER UPDATE OF status ON public.projeto_tarefas
  FOR EACH ROW EXECUTE FUNCTION public.trg_inbox_resolve_on_tarefa_fechada();

-- 3) Backfill
CREATE OR REPLACE FUNCTION public.inbox_backfill_inicial()
RETURNS TABLE(atribuidas int, delegadas int, aprovacoes int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_atrib int := 0;
  v_deleg int := 0;
  v_aprov int := 0;
BEGIN
  FOR r IN
    SELECT t.id, t.titulo, t.projeto_id, t.responsavel_id, t.criador_id, p.nome AS projeto_nome
      FROM public.projeto_tarefas t
      LEFT JOIN public.projetos p ON p.id = t.projeto_id
     WHERE t.responsavel_id IS NOT NULL
       AND COALESCE(t.status, 'pendente') NOT IN ('concluida','cancelada')
       AND t.criador_id IS DISTINCT FROM t.responsavel_id
  LOOP
    PERFORM public.inbox_emit(
      r.responsavel_id, 'atribuida_a_mim'::inbox_caixa, 'projetos'::inbox_origem,
      'atribuida', 'auto'::inbox_modo_leitura,
      COALESCE(r.titulo, 'Tarefa'), NULL,
      '/dashboard/projetos/' || r.projeto_id::text,
      'projeto_tarefa', r.id,
      r.projeto_id, NULL, NULL, 'projetos',
      r.criador_id,
      jsonb_build_object('projeto_nome', r.projeto_nome, 'backfill', true)
    );
    v_atrib := v_atrib + 1;

    IF r.criador_id IS NOT NULL THEN
      PERFORM public.inbox_emit(
        r.criador_id, 'delegada_por_mim'::inbox_caixa, 'projetos'::inbox_origem,
        'delegada', 'auto'::inbox_modo_leitura,
        COALESCE(r.titulo, 'Tarefa'), NULL,
        '/dashboard/projetos/' || r.projeto_id::text,
        'projeto_tarefa', r.id,
        r.projeto_id, NULL, NULL, 'projetos',
        r.criador_id,
        jsonb_build_object('projeto_nome', r.projeto_nome, 'responsavel_id', r.responsavel_id, 'backfill', true)
      );
      v_deleg := v_deleg + 1;
    END IF;
  END LOOP;

  FOR r IN
    SELECT id, usuario_id, instancia_id
      FROM public.fluxo_aprovacao_aprovadores
     WHERE status = 'pendente' AND usuario_id IS NOT NULL
  LOOP
    PERFORM public.inbox_emit(
      r.usuario_id, 'acao_minha'::inbox_caixa, 'aprovacoes'::inbox_origem,
      'aprovacao_pendente', 'acao'::inbox_modo_leitura,
      'Aprovação pendente', NULL, '/dashboard/aprovacoes',
      'aprovador', r.id,
      NULL, NULL, NULL, 'aprovacoes',
      NULL,
      jsonb_build_object('instancia_id', r.instancia_id, 'backfill', true)
    );
    v_aprov := v_aprov + 1;
  END LOOP;

  RETURN QUERY SELECT v_atrib, v_deleg, v_aprov;
END;
$$;

SELECT * FROM public.inbox_backfill_inicial();
