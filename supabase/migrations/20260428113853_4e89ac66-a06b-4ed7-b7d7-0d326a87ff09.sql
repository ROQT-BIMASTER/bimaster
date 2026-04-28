
-- 1. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_projeto_ativas_ordem
  ON public.projeto_tarefas (projeto_id, ordem)
  WHERE excluida_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_responsavel_status
  ON public.projeto_tarefas (responsavel_id, status)
  WHERE excluida_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_prazo_pendentes
  ON public.projeto_tarefas (data_prazo)
  WHERE excluida_em IS NULL AND status <> 'concluida';

CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_secao_ativas
  ON public.projeto_tarefas (secao_id, ordem)
  WHERE excluida_em IS NULL AND secao_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projeto_tarefa_atividades_tarefa_created
  ON public.projeto_tarefa_atividades (tarefa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projeto_atividades_projeto_created
  ON public.projeto_atividades (projeto_id, created_at DESC);

-- 2. PUBLICADOR DE projeto_atividades (timeline geral)
CREATE OR REPLACE FUNCTION public.log_projeto_timeline_tarefa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO projeto_atividades (projeto_id, tarefa_id, user_id, tipo, descricao, metadata)
    VALUES (NEW.projeto_id, NEW.id, v_user, 'tarefa_criada',
            'Tarefa criada: ' || COALESCE(NEW.titulo, '(sem título)'),
            jsonb_build_object('titulo', NEW.titulo, 'codigo', NEW.codigo));
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.excluida_em IS NULL AND NEW.excluida_em IS NOT NULL THEN
      INSERT INTO projeto_atividades (projeto_id, tarefa_id, user_id, tipo, descricao, metadata)
      VALUES (NEW.projeto_id, NEW.id, v_user, 'tarefa_excluida',
              'Tarefa excluída: ' || COALESCE(NEW.titulo, '(sem título)'),
              jsonb_build_object('titulo', NEW.titulo, 'codigo', NEW.codigo));
    ELSIF OLD.excluida_em IS NOT NULL AND NEW.excluida_em IS NULL THEN
      INSERT INTO projeto_atividades (projeto_id, tarefa_id, user_id, tipo, descricao, metadata)
      VALUES (NEW.projeto_id, NEW.id, v_user, 'tarefa_restaurada',
              'Tarefa restaurada: ' || COALESCE(NEW.titulo, '(sem título)'),
              jsonb_build_object('titulo', NEW.titulo, 'codigo', NEW.codigo));
    ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'concluida' THEN
      INSERT INTO projeto_atividades (projeto_id, tarefa_id, user_id, tipo, descricao, metadata)
      VALUES (NEW.projeto_id, NEW.id, v_user, 'tarefa_concluida',
              'Tarefa concluída: ' || COALESCE(NEW.titulo, '(sem título)'),
              jsonb_build_object('titulo', NEW.titulo, 'codigo', NEW.codigo));
    END IF;
    RETURN NEW;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_log_projeto_timeline_tarefa ON public.projeto_tarefas;
CREATE TRIGGER trg_log_projeto_timeline_tarefa
AFTER INSERT OR UPDATE OF status, excluida_em ON public.projeto_tarefas
FOR EACH ROW EXECUTE FUNCTION public.log_projeto_timeline_tarefa();

CREATE OR REPLACE FUNCTION public.log_projeto_timeline_secao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO projeto_atividades (projeto_id, user_id, tipo, descricao, metadata)
    VALUES (NEW.projeto_id, v_user, 'secao_criada',
            'Seção criada: ' || COALESCE(NEW.nome, '(sem nome)'),
            jsonb_build_object('nome', NEW.nome));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO projeto_atividades (projeto_id, user_id, tipo, descricao, metadata)
    VALUES (OLD.projeto_id, v_user, 'secao_excluida',
            'Seção excluída: ' || COALESCE(OLD.nome, '(sem nome)'),
            jsonb_build_object('nome', OLD.nome));
    RETURN OLD;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_log_projeto_timeline_secao ON public.projeto_secoes;
CREATE TRIGGER trg_log_projeto_timeline_secao
AFTER INSERT OR DELETE ON public.projeto_secoes
FOR EACH ROW EXECUTE FUNCTION public.log_projeto_timeline_secao();

-- 3. VALIDAÇÃO: projeto genérico não aceita vínculos de produto/China
CREATE OR REPLACE FUNCTION public.validate_vinculo_projeto_nao_generico()
RETURNS trigger LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_tipo text;
BEGIN
  SELECT tipo INTO v_tipo FROM projetos WHERE id = NEW.projeto_id;
  IF v_tipo = 'generico' THEN
    RAISE EXCEPTION 'Projetos do tipo "genérico" não permitem vínculo com produtos ou submissões China'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_vinculo_produto_projeto_tipo ON public.projeto_produto_vinculos;
CREATE TRIGGER trg_validate_vinculo_produto_projeto_tipo
BEFORE INSERT OR UPDATE OF projeto_id ON public.projeto_produto_vinculos
FOR EACH ROW EXECUTE FUNCTION public.validate_vinculo_projeto_nao_generico();

DROP TRIGGER IF EXISTS trg_validate_vinculo_china_projeto_tipo ON public.china_submissao_tarefa_vinculos;
CREATE TRIGGER trg_validate_vinculo_china_projeto_tipo
BEFORE INSERT OR UPDATE OF projeto_id ON public.china_submissao_tarefa_vinculos
FOR EACH ROW EXECUTE FUNCTION public.validate_vinculo_projeto_nao_generico();

-- 4. SEGURANÇA: revogar EXECUTE de anon nas funções de projeto
REVOKE EXECUTE ON FUNCTION public.user_can_access_projeto(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_can_access_projeto_via_tarefa(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_user_in_projetos_department(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_projeto_metrics() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_projetos_member_avatars() FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolver_projeto_da_instancia(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.user_can_access_projeto(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_projeto_via_tarefa(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_in_projetos_department(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_projeto_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_projetos_member_avatars() TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_projeto_da_instancia(uuid) TO authenticated;
