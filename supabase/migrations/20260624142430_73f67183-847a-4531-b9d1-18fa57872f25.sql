
-- Fase 2 (PR-3) — Sincronização bidirecional Submissão↔Projeto, GATED por feature flag.
-- Esta migration é puramente aditiva e inerte por padrão: a flag nasce OFF.
-- Nada propaga até que a flag seja ativada manualmente em produção.

-- 1) Feature flag desligada por padrão
INSERT INTO public.feature_flags (codigo, nome, descricao, ativo)
VALUES (
  'ff_projeto_sync_bidirecional',
  'Sincronização bidirecional Submissão↔Projeto',
  'Quando ativa, conclusão de tarefa do projeto propaga para o item de checklist da submissão e vice-versa.',
  false
)
ON CONFLICT (codigo) DO NOTHING;

-- 2) Helper STABLE para checar flag (cacheável dentro da query)
CREATE OR REPLACE FUNCTION public.f_feature_flag_ativa(p_codigo text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT ativo FROM public.feature_flags WHERE codigo = p_codigo), false);
$$;

-- 3) Trigger: tarefa do projeto → item do checklist B2C
CREATE OR REPLACE FUNCTION public.tg_projeto_tarefa_sync_to_checklist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Anti-loop: ignora se já estamos dentro de outro trigger
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Gate por feature flag — em produção fica OFF até liberação explícita
  IF NOT public.f_feature_flag_ativa('ff_projeto_sync_bidirecional') THEN
    RETURN NEW;
  END IF;

  -- Só age quando status mudou para 'concluida'
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'concluida' THEN
    UPDATE public.china_checklist_brasil_china
       SET status = 'concluido',
           respondido_em = COALESCE(respondido_em, now()),
           updated_at = now()
     WHERE projeto_tarefa_id = NEW.id
       AND status NOT IN ('concluido','aprovado','recusado','reprovado','cancelado');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projeto_tarefa_sync_checklist ON public.projeto_tarefas;
CREATE TRIGGER trg_projeto_tarefa_sync_checklist
AFTER UPDATE OF status ON public.projeto_tarefas
FOR EACH ROW
EXECUTE FUNCTION public.tg_projeto_tarefa_sync_to_checklist();

-- 4) Trigger: item do checklist B2C → tarefa do projeto
CREATE OR REPLACE FUNCTION public.tg_checklist_sync_to_projeto_tarefa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NOT public.f_feature_flag_ativa('ff_projeto_sync_bidirecional') THEN
    RETURN NEW;
  END IF;

  IF NEW.projeto_tarefa_id IS NOT NULL
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('concluido','aprovado') THEN
    UPDATE public.projeto_tarefas
       SET status = 'concluida',
           updated_at = now()
     WHERE id = NEW.projeto_tarefa_id
       AND status <> 'concluida';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checklist_sync_projeto_tarefa ON public.china_checklist_brasil_china;
CREATE TRIGGER trg_checklist_sync_projeto_tarefa
AFTER UPDATE OF status ON public.china_checklist_brasil_china
FOR EACH ROW
EXECUTE FUNCTION public.tg_checklist_sync_to_projeto_tarefa();

-- 5) Comentários para futuras gerações de IA e devs
COMMENT ON FUNCTION public.tg_projeto_tarefa_sync_to_checklist() IS
  'Fase 2 unificação Submissão↔Projeto. INERTE até feature_flag ff_projeto_sync_bidirecional = true.';
COMMENT ON FUNCTION public.tg_checklist_sync_to_projeto_tarefa() IS
  'Fase 2 unificação Submissão↔Projeto. INERTE até feature_flag ff_projeto_sync_bidirecional = true.';
