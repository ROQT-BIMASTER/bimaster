-- ============================================================================
-- 1) Bridge: projeto_atividades -> inbox
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_inbox_from_projeto_atividade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_responsavel uuid;
  v_criador     uuid;
  v_titulo      text;
  v_projeto     text;
  v_modo        inbox_modo_leitura;
  v_caixa_resp  inbox_caixa;
  v_tipo        text;
  v_acao_url    text;
BEGIN
  -- Só relevante para atividades vinculadas a uma tarefa
  IF NEW.tarefa_id IS NULL THEN RETURN NEW; END IF;

  SELECT t.responsavel_id, t.criador_id, t.titulo, p.nome
    INTO v_responsavel, v_criador, v_titulo, v_projeto
  FROM public.projeto_tarefas t
  LEFT JOIN public.projetos p ON p.id = t.projeto_id
  WHERE t.id = NEW.tarefa_id;

  -- Mapear tipo do evento
  v_tipo := NEW.tipo;
  v_modo := CASE
    WHEN NEW.tipo IN ('mencao','comentou','moveu','completou','criou_tarefa','compartilhou') THEN 'auto'::inbox_modo_leitura
    ELSE 'auto'::inbox_modo_leitura
  END;
  v_caixa_resp := CASE
    WHEN NEW.tipo = 'mencao' THEN 'acao_minha'::inbox_caixa
    ELSE 'atribuida_a_mim'::inbox_caixa
  END;
  v_acao_url := '/dashboard/projetos/' || NEW.projeto_id::text;

  -- Notifica o responsável (se diferente de quem gerou o evento)
  IF v_responsavel IS NOT NULL AND v_responsavel <> NEW.user_id THEN
    PERFORM public.inbox_emit(
      v_responsavel,
      v_caixa_resp,
      'projetos'::inbox_origem,
      v_tipo,
      v_modo,
      COALESCE(v_titulo, 'Tarefa'),
      LEFT(COALESCE(NEW.descricao, ''), 240),
      v_acao_url,
      'projeto_tarefa', NEW.tarefa_id,
      NEW.projeto_id, NULL, NULL, 'projetos',
      NEW.user_id,
      jsonb_build_object('atividade_id', NEW.id, 'projeto_nome', v_projeto)
    );
  END IF;

  -- Para criador, vai como "delegada por mim" (apenas em conclusão/movimentação)
  IF v_criador IS NOT NULL AND v_criador <> NEW.user_id AND v_criador <> v_responsavel
     AND NEW.tipo IN ('completou','moveu') THEN
    PERFORM public.inbox_emit(
      v_criador,
      'delegada_por_mim'::inbox_caixa,
      'projetos'::inbox_origem,
      v_tipo,
      'auto'::inbox_modo_leitura,
      COALESCE(v_titulo, 'Tarefa'),
      LEFT(COALESCE(NEW.descricao, ''), 240),
      v_acao_url,
      'projeto_tarefa', NEW.tarefa_id,
      NEW.projeto_id, NULL, NULL, 'projetos',
      NEW.user_id,
      jsonb_build_object('atividade_id', NEW.id, 'projeto_nome', v_projeto)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inbox_from_projeto_atividade ON public.projeto_atividades;
CREATE TRIGGER trg_inbox_from_projeto_atividade
  AFTER INSERT ON public.projeto_atividades
  FOR EACH ROW EXECUTE FUNCTION public.trg_inbox_from_projeto_atividade();

-- ============================================================================
-- 2) Bridge: processo_tarefa_espelho -> inbox
--    Mantém a sincronização viva: aparece em "Ação minha" enquanto faltar doc;
--    é resolvido automaticamente quando a evidência é registrada.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_inbox_from_espelho()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_responsavel uuid;
  v_titulo      text;
  v_projeto     text;
BEGIN
  IF NEW.projeto_tarefa_id IS NULL THEN RETURN NEW; END IF;

  SELECT t.responsavel_id, t.titulo, p.nome
    INTO v_responsavel, v_titulo, v_projeto
  FROM public.projeto_tarefas t
  LEFT JOIN public.projetos p ON p.id = t.projeto_id
  WHERE t.id = NEW.projeto_tarefa_id;

  IF v_responsavel IS NULL THEN RETURN NEW; END IF;

  -- Evidência registrada? Resolve item antigo da inbox.
  IF NEW.evidencia_documento_id IS NOT NULL OR NEW.status = 'concluida' THEN
    PERFORM public.inbox_resolver_item('processo_tarefa_espelho', NEW.id, 'evidencia_pendente');
    -- Cria/atualiza item informativo na caixa "atribuida_a_mim" (modo auto)
    PERFORM public.inbox_emit(
      v_responsavel,
      'atribuida_a_mim'::inbox_caixa,
      'processos'::inbox_origem,
      'concluida_com_evidencia',
      'auto'::inbox_modo_leitura,
      'Tarefa concluída com evidência',
      'Tarefa "' || COALESCE(v_titulo,'(sem título)') || '" do projeto ' || COALESCE(v_projeto,'') || ' foi concluída com evidência registrada no processo.',
      '/dashboard/projetos/' || NEW.projeto_id::text,
      'processo_tarefa_espelho', NEW.id,
      NEW.projeto_id, NEW.instancia_id, NEW.etapa_id, 'processos',
      auth.uid(),
      jsonb_build_object('espelho_status', NEW.status)
    );
    RETURN NEW;
  END IF;

  -- Pendente sem documento → caixa "Ação minha", modo "acao"
  IF NEW.exige_documentos = true AND NEW.evidencia_documento_id IS NULL THEN
    PERFORM public.inbox_emit(
      v_responsavel,
      'acao_minha'::inbox_caixa,
      'processos'::inbox_origem,
      CASE WHEN NEW.acao_solicitada_em IS NOT NULL THEN 'acao_solicitada' ELSE 'evidencia_pendente' END,
      'acao'::inbox_modo_leitura,
      CASE WHEN NEW.acao_solicitada_em IS NOT NULL
           THEN 'Ação solicitada: documento oficial pendente'
           ELSE 'Documento oficial pendente'
      END,
      'Tarefa "' || COALESCE(v_titulo,'(sem título)') || '" do projeto ' || COALESCE(v_projeto,'') || ' aguarda seleção de documento oficial para concluir.',
      '/dashboard/projetos/' || NEW.projeto_id::text,
      'processo_tarefa_espelho', NEW.id,
      NEW.projeto_id, NEW.instancia_id, NEW.etapa_id, 'processos',
      NEW.acao_solicitada_por,
      jsonb_build_object(
        'acao_solicitada_em', NEW.acao_solicitada_em,
        'exige_documentos', NEW.exige_documentos
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inbox_from_espelho_ins ON public.processo_tarefa_espelho;
CREATE TRIGGER trg_inbox_from_espelho_ins
  AFTER INSERT ON public.processo_tarefa_espelho
  FOR EACH ROW EXECUTE FUNCTION public.trg_inbox_from_espelho();

DROP TRIGGER IF EXISTS trg_inbox_from_espelho_upd ON public.processo_tarefa_espelho;
CREATE TRIGGER trg_inbox_from_espelho_upd
  AFTER UPDATE ON public.processo_tarefa_espelho
  FOR EACH ROW EXECUTE FUNCTION public.trg_inbox_from_espelho();

-- ============================================================================
-- 3) Bridge: fluxo_aprovacao_aprovadores -> inbox
--    Quando um aprovador é adicionado e está pendente: vira "Ação minha".
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_inbox_from_aprovador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titulo  text;
  v_etapa   text;
  v_proj    uuid;
  v_action  text;
BEGIN
  IF NEW.usuario_id IS NULL THEN RETURN NEW; END IF;

  -- Pendente → cria/atualiza inbox; resolvido → resolve
  IF NEW.status <> 'pendente' THEN
    PERFORM public.inbox_resolver_item('fluxo_aprovacao_aprovador', NEW.id, 'aprovacao_pendente');
    RETURN NEW;
  END IF;

  SELECT i.titulo, e.nome, i.projeto_id
    INTO v_titulo, v_etapa, v_proj
  FROM public.fluxo_aprovacao_instancias i
  JOIN public.fluxo_aprovacao_etapas e ON e.id = NEW.etapa_id
  WHERE i.id = NEW.instancia_id;

  v_action := '/dashboard/aprovacoes/instancia/' || NEW.instancia_id::text;

  PERFORM public.inbox_emit(
    NEW.usuario_id,
    'acao_minha'::inbox_caixa,
    'aprovacoes'::inbox_origem,
    'aprovacao_pendente',
    'acao'::inbox_modo_leitura,
    COALESCE('Aprovação pendente: ' || v_etapa, 'Aprovação pendente'),
    COALESCE(v_titulo, 'Item aguardando sua aprovação'),
    v_action,
    'fluxo_aprovacao_aprovador', NEW.id,
    v_proj, NULL, NEW.etapa_id, 'aprovacoes',
    NULL,
    jsonb_build_object('instancia_id', NEW.instancia_id, 'etapa_nome', v_etapa)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inbox_from_aprovador_ins ON public.fluxo_aprovacao_aprovadores;
CREATE TRIGGER trg_inbox_from_aprovador_ins
  AFTER INSERT ON public.fluxo_aprovacao_aprovadores
  FOR EACH ROW EXECUTE FUNCTION public.trg_inbox_from_aprovador();

DROP TRIGGER IF EXISTS trg_inbox_from_aprovador_upd ON public.fluxo_aprovacao_aprovadores;
CREATE TRIGGER trg_inbox_from_aprovador_upd
  AFTER UPDATE OF status ON public.fluxo_aprovacao_aprovadores
  FOR EACH ROW EXECUTE FUNCTION public.trg_inbox_from_aprovador();