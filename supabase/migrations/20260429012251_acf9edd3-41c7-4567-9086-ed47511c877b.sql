
-- =====================================================================
-- 1. RPC get_minhas_delegadas_central — tarefas que criei e delegei
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_minhas_delegadas_central()
RETURNS TABLE (
  id uuid,
  titulo text,
  descricao text,
  status text,
  prioridade text,
  data_inicio_planejada date,
  data_prazo date,
  data_conclusao date,
  projeto_id uuid,
  projeto_nome text,
  projeto_cor text,
  estagio text,
  criador_id uuid,
  visibilidade text,
  secao_id uuid,
  secao_nome text,
  ordem integer,
  parent_tarefa_id uuid,
  responsavel_id uuid,
  responsavel_nome text,
  responsavel_avatar_url text,
  codigo text,
  produto_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT
    t.id,
    t.titulo,
    t.descricao,
    t.status,
    t.prioridade,
    t.data_inicio_planejada,
    t.data_prazo,
    t.data_conclusao,
    t.projeto_id,
    COALESCE(p.nome, 'Sem projeto') AS projeto_nome,
    COALESCE(p.cor, '#6366f1') AS projeto_cor,
    t.estagio,
    t.criador_id,
    t.visibilidade,
    t.secao_id,
    s.nome AS secao_nome,
    COALESCE(t.ordem, 0) AS ordem,
    t.parent_tarefa_id,
    t.responsavel_id,
    pr.nome AS responsavel_nome,
    pr.avatar_url AS responsavel_avatar_url,
    t.codigo,
    t.produto_id,
    t.created_at,
    t.updated_at
  FROM public.projeto_tarefas t
  LEFT JOIN public.projetos p ON p.id = t.projeto_id
  LEFT JOIN public.projeto_secoes s ON s.id = t.secao_id
  LEFT JOIN public.profiles pr ON pr.id = t.responsavel_id
  WHERE auth.uid() IS NOT NULL
    AND t.excluida_em IS NULL
    AND t.criador_id = auth.uid()
    AND (t.responsavel_id IS DISTINCT FROM auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.projeto_tarefa_colaboradores c
      WHERE c.tarefa_id = t.id AND c.user_id = auth.uid()
    )
  ORDER BY t.data_prazo ASC NULLS LAST, t.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_minhas_delegadas_central() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_minhas_delegadas_central() TO authenticated;

CREATE INDEX IF NOT EXISTS idx_tarefas_criador_ativas
  ON public.projeto_tarefas(criador_id) WHERE excluida_em IS NULL;

-- =====================================================================
-- 2. Auditoria de mudanças de acesso a tarefas
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.projeto_tarefa_acesso_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  projeto_id uuid,
  user_afetado_id uuid NOT NULL,
  ator_id uuid,
  acao text NOT NULL CHECK (acao IN ('ganhou_acesso','perdeu_acesso')),
  motivo text NOT NULL CHECK (motivo IN (
    'responsavel_alterado','colaborador_adicionado','colaborador_removido',
    'secao_liberada','secao_revogada','tarefa_movida_secao',
    'membro_projeto_adicionado','membro_projeto_removido','tarefa_excluida'
  )),
  papel_anterior text,
  papel_novo text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acesso_audit_tarefa
  ON public.projeto_tarefa_acesso_audit(tarefa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_acesso_audit_user
  ON public.projeto_tarefa_acesso_audit(user_afetado_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_acesso_audit_projeto
  ON public.projeto_tarefa_acesso_audit(projeto_id, created_at DESC);

ALTER TABLE public.projeto_tarefa_acesso_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Audit visível para afetado, ator ou admin" ON public.projeto_tarefa_acesso_audit;
CREATE POLICY "Audit visível para afetado, ator ou admin"
  ON public.projeto_tarefa_acesso_audit
  FOR SELECT
  TO authenticated
  USING (
    user_afetado_id = auth.uid()
    OR ator_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- INSERT/UPDATE/DELETE bloqueados (apenas SECURITY DEFINER triggers podem inserir)
DROP POLICY IF EXISTS "Audit bloqueia escrita direta" ON public.projeto_tarefa_acesso_audit;
CREATE POLICY "Audit bloqueia escrita direta"
  ON public.projeto_tarefa_acesso_audit
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ---------- Trigger: troca de responsável ----------
CREATE OR REPLACE FUNCTION public.audit_tarefa_responsavel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ator uuid := auth.uid();
BEGIN
  IF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id THEN
    -- Antigo perde acesso (a menos que continue como colaborador)
    IF OLD.responsavel_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.projeto_tarefa_colaboradores
         WHERE tarefa_id = NEW.id AND user_id = OLD.responsavel_id
       )
    THEN
      INSERT INTO public.projeto_tarefa_acesso_audit
        (tarefa_id, projeto_id, user_afetado_id, ator_id, acao, motivo, papel_anterior, papel_novo)
      VALUES
        (NEW.id, NEW.projeto_id, OLD.responsavel_id, v_ator, 'perdeu_acesso',
         'responsavel_alterado', 'responsavel', NULL);
    END IF;
    -- Novo ganha acesso
    IF NEW.responsavel_id IS NOT NULL THEN
      INSERT INTO public.projeto_tarefa_acesso_audit
        (tarefa_id, projeto_id, user_afetado_id, ator_id, acao, motivo, papel_anterior, papel_novo)
      VALUES
        (NEW.id, NEW.projeto_id, NEW.responsavel_id, v_ator, 'ganhou_acesso',
         'responsavel_alterado', NULL, 'responsavel');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_tarefa_responsavel ON public.projeto_tarefas;
CREATE TRIGGER trg_audit_tarefa_responsavel
AFTER UPDATE OF responsavel_id ON public.projeto_tarefas
FOR EACH ROW EXECUTE FUNCTION public.audit_tarefa_responsavel();

-- ---------- Trigger: tarefa excluída/restaurada ----------
CREATE OR REPLACE FUNCTION public.audit_tarefa_excluida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ator uuid := auth.uid();
BEGIN
  -- Foi excluída agora
  IF OLD.excluida_em IS NULL AND NEW.excluida_em IS NOT NULL THEN
    -- Responsável
    IF NEW.responsavel_id IS NOT NULL THEN
      INSERT INTO public.projeto_tarefa_acesso_audit
        (tarefa_id, projeto_id, user_afetado_id, ator_id, acao, motivo, papel_anterior, papel_novo)
      VALUES (NEW.id, NEW.projeto_id, NEW.responsavel_id, v_ator,
              'perdeu_acesso', 'tarefa_excluida', 'responsavel', NULL);
    END IF;
    -- Colaboradores
    INSERT INTO public.projeto_tarefa_acesso_audit
      (tarefa_id, projeto_id, user_afetado_id, ator_id, acao, motivo, papel_anterior, papel_novo)
    SELECT NEW.id, NEW.projeto_id, c.user_id, v_ator,
           'perdeu_acesso', 'tarefa_excluida', 'colaborador', NULL
    FROM public.projeto_tarefa_colaboradores c
    WHERE c.tarefa_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_tarefa_excluida ON public.projeto_tarefas;
CREATE TRIGGER trg_audit_tarefa_excluida
AFTER UPDATE OF excluida_em ON public.projeto_tarefas
FOR EACH ROW EXECUTE FUNCTION public.audit_tarefa_excluida();

-- ---------- Trigger: colaborador adicionado/removido ----------
CREATE OR REPLACE FUNCTION public.audit_tarefa_colaborador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ator uuid := auth.uid();
  v_projeto uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT projeto_id INTO v_projeto FROM public.projeto_tarefas WHERE id = NEW.tarefa_id;
    INSERT INTO public.projeto_tarefa_acesso_audit
      (tarefa_id, projeto_id, user_afetado_id, ator_id, acao, motivo, papel_anterior, papel_novo)
    VALUES (NEW.tarefa_id, v_projeto, NEW.user_id, v_ator,
            'ganhou_acesso', 'colaborador_adicionado', NULL, 'colaborador');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT projeto_id INTO v_projeto FROM public.projeto_tarefas WHERE id = OLD.tarefa_id;
    -- Só registra perda se a pessoa não for responsável da tarefa
    IF NOT EXISTS (
      SELECT 1 FROM public.projeto_tarefas
      WHERE id = OLD.tarefa_id AND responsavel_id = OLD.user_id
    ) THEN
      INSERT INTO public.projeto_tarefa_acesso_audit
        (tarefa_id, projeto_id, user_afetado_id, ator_id, acao, motivo, papel_anterior, papel_novo)
      VALUES (OLD.tarefa_id, v_projeto, OLD.user_id, v_ator,
              'perdeu_acesso', 'colaborador_removido', 'colaborador', NULL);
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_tarefa_colaborador ON public.projeto_tarefa_colaboradores;
CREATE TRIGGER trg_audit_tarefa_colaborador
AFTER INSERT OR DELETE ON public.projeto_tarefa_colaboradores
FOR EACH ROW EXECUTE FUNCTION public.audit_tarefa_colaborador();

-- ---------- Trigger: liberação/revogação de seção ----------
CREATE OR REPLACE FUNCTION public.audit_secao_membro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ator uuid := auth.uid();
  v_user uuid;
  v_projeto uuid;
  v_motivo text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT pm.user_id, pm.projeto_id INTO v_user, v_projeto
    FROM public.projeto_membros pm WHERE pm.id = NEW.membro_id;
    v_motivo := 'secao_liberada';

    INSERT INTO public.projeto_tarefa_acesso_audit
      (tarefa_id, projeto_id, user_afetado_id, ator_id, acao, motivo, papel_anterior, papel_novo, metadata)
    VALUES (NULL, v_projeto, v_user, v_ator, 'ganhou_acesso',
            v_motivo, NULL, 'secao', jsonb_build_object('secao_id', NEW.secao_id));
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    SELECT pm.user_id, pm.projeto_id INTO v_user, v_projeto
    FROM public.projeto_membros pm WHERE pm.id = OLD.membro_id;
    v_motivo := 'secao_revogada';

    INSERT INTO public.projeto_tarefa_acesso_audit
      (tarefa_id, projeto_id, user_afetado_id, ator_id, acao, motivo, papel_anterior, papel_novo, metadata)
    VALUES (NULL, v_projeto, v_user, v_ator, 'perdeu_acesso',
            v_motivo, 'secao', NULL, jsonb_build_object('secao_id', OLD.secao_id));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_secao_membro ON public.projeto_membro_secoes;
CREATE TRIGGER trg_audit_secao_membro
AFTER INSERT OR DELETE ON public.projeto_membro_secoes
FOR EACH ROW EXECUTE FUNCTION public.audit_secao_membro();

-- ---------- Trigger: membro do projeto adicionado/removido ----------
CREATE OR REPLACE FUNCTION public.audit_membro_projeto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ator uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.projeto_tarefa_acesso_audit
      (tarefa_id, projeto_id, user_afetado_id, ator_id, acao, motivo, papel_anterior, papel_novo, metadata)
    VALUES (NULL, NEW.projeto_id, NEW.user_id, v_ator, 'ganhou_acesso',
            'membro_projeto_adicionado', NULL, COALESCE(NEW.papel,'membro'),
            jsonb_build_object('papel', NEW.papel));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.projeto_tarefa_acesso_audit
      (tarefa_id, projeto_id, user_afetado_id, ator_id, acao, motivo, papel_anterior, papel_novo, metadata)
    VALUES (NULL, OLD.projeto_id, OLD.user_id, v_ator, 'perdeu_acesso',
            'membro_projeto_removido', COALESCE(OLD.papel,'membro'), NULL,
            jsonb_build_object('papel', OLD.papel));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_membro_projeto ON public.projeto_membros;
CREATE TRIGGER trg_audit_membro_projeto
AFTER INSERT OR DELETE ON public.projeto_membros
FOR EACH ROW EXECUTE FUNCTION public.audit_membro_projeto();

-- =====================================================================
-- 3. RPC debug_visibilidade_tarefa — admin only
-- =====================================================================
CREATE OR REPLACE FUNCTION public.debug_visibilidade_tarefa(
  p_tarefa_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tarefa RECORD;
  v_user RECORD;
  v_user_role text;
  v_papel_projeto text := 'nenhum';
  v_membro_id uuid;
  v_is_admin boolean;
  v_is_criador_projeto boolean;
  v_is_responsavel boolean;
  v_is_colaborador boolean;
  v_secao_liberada boolean;
  v_secoes_liberadas uuid[];
  v_central_visivel boolean;
  v_projeto_visivel boolean;
  central_motivos jsonb := '[]'::jsonb;
  central_bloqueios jsonb := '[]'::jsonb;
  projeto_motivos jsonb := '[]'::jsonb;
  projeto_bloqueios jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem usar a depuração de visibilidade';
  END IF;

  SELECT t.id, t.titulo, t.projeto_id, t.secao_id, t.responsavel_id, t.criador_id, t.excluida_em
    INTO v_tarefa
    FROM public.projeto_tarefas t WHERE t.id = p_tarefa_id;

  IF v_tarefa.id IS NULL THEN
    RAISE EXCEPTION 'Tarefa não encontrada';
  END IF;

  SELECT p.id, p.nome INTO v_user FROM public.profiles p WHERE p.id = p_user_id;

  SELECT role::text INTO v_user_role FROM public.user_roles WHERE user_id = p_user_id LIMIT 1;

  v_is_admin := public.has_role(p_user_id, 'admin'::app_role);
  SELECT EXISTS (SELECT 1 FROM public.projetos
    WHERE id = v_tarefa.projeto_id AND criado_por = p_user_id) INTO v_is_criador_projeto;

  SELECT id, papel INTO v_membro_id, v_papel_projeto
    FROM public.projeto_membros
    WHERE projeto_id = v_tarefa.projeto_id AND user_id = p_user_id LIMIT 1;
  IF v_papel_projeto IS NULL THEN v_papel_projeto := 'nenhum'; END IF;

  v_is_responsavel := (v_tarefa.responsavel_id = p_user_id);
  SELECT EXISTS (
    SELECT 1 FROM public.projeto_tarefa_colaboradores
    WHERE tarefa_id = p_tarefa_id AND user_id = p_user_id
  ) INTO v_is_colaborador;

  IF v_membro_id IS NOT NULL THEN
    SELECT array_agg(secao_id) INTO v_secoes_liberadas
      FROM public.projeto_membro_secoes WHERE membro_id = v_membro_id;
  END IF;
  v_secao_liberada := v_tarefa.secao_id = ANY(COALESCE(v_secoes_liberadas, ARRAY[]::uuid[]));

  -- Central
  IF v_tarefa.excluida_em IS NOT NULL THEN
    central_bloqueios := central_bloqueios || to_jsonb('tarefa_excluida'::text);
    v_central_visivel := false;
  ELSIF v_is_responsavel THEN
    central_motivos := central_motivos || to_jsonb('responsavel_direto'::text);
    v_central_visivel := true;
  ELSIF v_is_colaborador THEN
    central_motivos := central_motivos || to_jsonb('colaborador_explicito'::text);
    v_central_visivel := true;
  ELSE
    central_bloqueios := central_bloqueios || to_jsonb('nao_e_responsavel'::text)
                                          || to_jsonb('nao_e_colaborador'::text);
    v_central_visivel := false;
  END IF;

  -- Projeto
  IF v_tarefa.excluida_em IS NOT NULL THEN
    projeto_bloqueios := projeto_bloqueios || to_jsonb('tarefa_excluida'::text);
    v_projeto_visivel := false;
  ELSIF v_is_admin THEN
    projeto_motivos := projeto_motivos || to_jsonb('admin_sistema'::text);
    v_projeto_visivel := true;
  ELSIF v_is_criador_projeto THEN
    projeto_motivos := projeto_motivos || to_jsonb('criador_do_projeto'::text);
    v_projeto_visivel := true;
  ELSIF v_papel_projeto IN ('coordenador','gestor_produto') THEN
    projeto_motivos := projeto_motivos || to_jsonb(('papel_'||v_papel_projeto)::text);
    v_projeto_visivel := true;
  ELSIF v_is_responsavel OR v_is_colaborador THEN
    projeto_motivos := projeto_motivos
      || (CASE WHEN v_is_responsavel THEN to_jsonb('responsavel_direto'::text) ELSE '[]'::jsonb END)
      || (CASE WHEN v_is_colaborador THEN to_jsonb('colaborador_explicito'::text) ELSE '[]'::jsonb END);
    v_projeto_visivel := true;
  ELSE
    IF v_papel_projeto = 'nenhum' THEN
      projeto_bloqueios := projeto_bloqueios || to_jsonb('nao_e_membro_do_projeto'::text);
    ELSE
      projeto_bloqueios := projeto_bloqueios || to_jsonb('membro_sem_atribuicao_direta'::text);
      IF NOT v_secao_liberada THEN
        projeto_bloqueios := projeto_bloqueios || to_jsonb('secao_nao_liberada'::text);
      END IF;
    END IF;
    v_projeto_visivel := false;
  END IF;

  RETURN jsonb_build_object(
    'tarefa', jsonb_build_object(
      'id', v_tarefa.id, 'titulo', v_tarefa.titulo,
      'projeto_id', v_tarefa.projeto_id, 'secao_id', v_tarefa.secao_id,
      'responsavel_id', v_tarefa.responsavel_id, 'criador_id', v_tarefa.criador_id,
      'excluida_em', v_tarefa.excluida_em
    ),
    'user', jsonb_build_object(
      'id', p_user_id, 'nome', COALESCE(v_user.nome,'(desconhecido)'),
      'role_sistema', COALESCE(v_user_role, 'nenhum')
    ),
    'central', jsonb_build_object(
      'visivel', v_central_visivel,
      'motivos', central_motivos,
      'bloqueios', central_bloqueios
    ),
    'projeto', jsonb_build_object(
      'visivel', v_projeto_visivel,
      'papel_no_projeto', v_papel_projeto,
      'motivos', projeto_motivos,
      'bloqueios', projeto_bloqueios,
      'secao_liberada', v_secao_liberada,
      'secoes_liberadas', to_jsonb(COALESCE(v_secoes_liberadas, ARRAY[]::uuid[]))
    ),
    'regras_aplicadas', jsonb_build_array(
      jsonb_build_object('regra','is_admin','resultado',v_is_admin),
      jsonb_build_object('regra','is_criador_projeto','resultado',v_is_criador_projeto),
      jsonb_build_object('regra','papel_no_projeto','resultado',v_papel_projeto),
      jsonb_build_object('regra','is_responsavel','resultado',v_is_responsavel),
      jsonb_build_object('regra','is_colaborador','resultado',v_is_colaborador),
      jsonb_build_object('regra','secao_liberada','resultado',v_secao_liberada)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.debug_visibilidade_tarefa(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.debug_visibilidade_tarefa(uuid, uuid) TO authenticated;
