-- Corrige e otimiza o acesso central ao projeto.
CREATE OR REPLACE FUNCTION public.user_can_access_projeto(_user_id uuid, _projeto_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _project record;
BEGIN
  IF _user_id IS NULL OR _projeto_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT p.id, p.criador_id, p.visibilidade, p.deleted_at
    INTO _project
  FROM public.projetos p
  WHERE p.id = _projeto_id;

  IF _project.id IS NULL OR _project.deleted_at IS NOT NULL THEN
    RETURN false;
  END IF;

  IF _project.criador_id = _user_id OR _project.visibilidade = 'equipe' THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = 'admin'::public.app_role
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles pr ON pr.id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role = 'gerente'::public.app_role
      AND pr.supervisor_id IS NULL
      AND pr.departamento_id = '9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130'::uuid
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.projeto_membros pm
    WHERE pm.projeto_id = _projeto_id
      AND pm.user_id = _user_id
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.projeto_departamentos pd
    JOIN public.profiles pr ON pr.departamento_id = pd.departamento_id
    WHERE pd.projeto_id = _projeto_id
      AND pr.id = _user_id
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.projeto_tarefas t
    WHERE t.projeto_id = _projeto_id
      AND t.excluida_em IS NULL
      AND (t.criador_id = _user_id OR t.responsavel_id = _user_id)
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.projeto_tarefa_colaboradores c
    JOIN public.projeto_tarefas t ON t.id = c.tarefa_id
    WHERE t.projeto_id = _projeto_id
      AND t.excluida_em IS NULL
      AND c.user_id = _user_id
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.projeto_tarefa_responsaveis r
    JOIN public.projeto_tarefas t ON t.id = r.tarefa_id
    WHERE t.projeto_id = _projeto_id
      AND t.excluida_em IS NULL
      AND r.user_id = _user_id
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.projeto_tarefa_seguidores s
    JOIN public.projeto_tarefas t ON t.id = s.tarefa_id
    WHERE t.projeto_id = _projeto_id
      AND t.excluida_em IS NULL
      AND s.user_id = _user_id
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

-- Evita função SQL inline consultando a própria tabela em policy de projeto_secoes.
CREATE OR REPLACE FUNCTION public.user_can_access_secao(_user_id uuid, _secao_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _projeto_id uuid;
BEGIN
  IF _user_id IS NULL OR _secao_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT ps.projeto_id
    INTO _projeto_id
  FROM public.projeto_secoes ps
  WHERE ps.id = _secao_id;

  RETURN public.user_can_access_projeto(_user_id, _projeto_id);
END;
$function$;

-- Recria policies de seções com regra explícita por projeto e leitura sem recursão.
DROP POLICY IF EXISTS "Members can insert projeto_secoes" ON public.projeto_secoes;
DROP POLICY IF EXISTS "Users view accessible sections" ON public.projeto_secoes;
DROP POLICY IF EXISTS "Members can update projeto_secoes" ON public.projeto_secoes;
DROP POLICY IF EXISTS "Members can delete projeto_secoes" ON public.projeto_secoes;

CREATE POLICY "Users can view accessible projeto_secoes"
ON public.projeto_secoes
FOR SELECT
TO authenticated
USING (public.user_can_access_projeto((SELECT auth.uid()), projeto_id));

CREATE POLICY "Users can create accessible projeto_secoes"
ON public.projeto_secoes
FOR INSERT
TO authenticated
WITH CHECK (public.user_can_access_projeto((SELECT auth.uid()), projeto_id));

CREATE POLICY "Users can update accessible projeto_secoes"
ON public.projeto_secoes
FOR UPDATE
TO authenticated
USING (public.user_can_access_projeto((SELECT auth.uid()), projeto_id))
WITH CHECK (public.user_can_access_projeto((SELECT auth.uid()), projeto_id));

CREATE POLICY "Users can delete accessible projeto_secoes"
ON public.projeto_secoes
FOR DELETE
TO authenticated
USING (public.user_can_access_projeto((SELECT auth.uid()), projeto_id));

-- Índices para acelerar checagens de acesso e montagem do quadro.
CREATE INDEX IF NOT EXISTS idx_projetos_access_visibility
  ON public.projetos (id, visibilidade, criador_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_projeto_ativas_id
  ON public.projeto_tarefas (projeto_id, id)
  WHERE excluida_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_projeto_criador_ativas
  ON public.projeto_tarefas (projeto_id, criador_id)
  WHERE excluida_em IS NULL AND criador_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_projeto_responsavel_ativas
  ON public.projeto_tarefas (projeto_id, responsavel_id)
  WHERE excluida_em IS NULL AND responsavel_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projeto_tarefa_colaboradores_user
  ON public.projeto_tarefa_colaboradores (user_id, tarefa_id);

CREATE INDEX IF NOT EXISTS idx_projeto_tarefa_seguidores_user_tarefa
  ON public.projeto_tarefa_seguidores (user_id, tarefa_id);

CREATE INDEX IF NOT EXISTS idx_projeto_membros_user_projeto
  ON public.projeto_membros (user_id, projeto_id);

-- Otimiza payload consolidado sem perder campos usados pela interface.
CREATE OR REPLACE FUNCTION public.get_projeto_tarefas_v2(p_projeto_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_total_secoes int;
  v_total_tarefas_projeto int;
  result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT public.user_can_access_projeto(v_user_id, p_projeto_id) THEN
    RAISE EXCEPTION 'Sem permissão para acessar este projeto';
  END IF;

  SELECT COUNT(*) INTO v_total_secoes
  FROM public.projeto_secoes
  WHERE projeto_id = p_projeto_id;

  SELECT COUNT(*) INTO v_total_tarefas_projeto
  FROM public.projeto_tarefas
  WHERE projeto_id = p_projeto_id
    AND excluida_em IS NULL;

  WITH visible_secoes AS MATERIALIZED (
    SELECT s.id, s.projeto_id, s.nome, s.ordem, s.created_at, s.tem_briefing,
           s.data_inicio, s.data_prazo, s.dias_alerta_antes
    FROM public.projeto_secoes s
    WHERE s.projeto_id = p_projeto_id
    ORDER BY s.ordem
  ),
  visible_tarefas AS MATERIALIZED (
    SELECT
      t.id,
      t.projeto_id,
      t.secao_id,
      t.parent_tarefa_id,
      t.titulo,
      t.descricao,
      t.responsavel_id,
      t.status,
      t.prioridade,
      t.data_prazo,
      t.data_conclusao,
      t.codigo,
      t.visibilidade,
      t.ordem,
      t.created_at,
      t.updated_at,
      t.estagio,
      t.criador_id,
      t.produto_id,
      t.validacao_status,
      t.data_inicio_planejada,
      t.dias_alerta_antes,
      t.tem_briefing,
      t.tipo_tarefa,
      t.motivo_retrabalho,
      t.data_inicio,
      t.codigo_acom,
      t.canal_criacao,
      t.is_subtask,
      t.origem_projeto
    FROM public.projeto_tarefas t
    WHERE t.projeto_id = p_projeto_id
      AND t.excluida_em IS NULL
    ORDER BY t.secao_id NULLS LAST, t.ordem, t.created_at
  ),
  user_ids_set AS MATERIALIZED (
    SELECT responsavel_id AS uid FROM visible_tarefas WHERE responsavel_id IS NOT NULL
    UNION
    SELECT criador_id FROM visible_tarefas WHERE criador_id IS NOT NULL
    UNION
    SELECT c.user_id
    FROM public.projeto_tarefa_colaboradores c
    JOIN visible_tarefas vt ON vt.id = c.tarefa_id
    UNION
    SELECT r.user_id
    FROM public.projeto_tarefa_responsaveis r
    JOIN visible_tarefas vt ON vt.id = r.tarefa_id
    UNION
    SELECT pm.user_id
    FROM public.projeto_membros pm
    WHERE pm.projeto_id = p_projeto_id
  ),
  profiles_data AS MATERIALIZED (
    SELECT p.id, p.nome, p.avatar_url
    FROM public.profiles p
    JOIN user_ids_set u ON u.uid = p.id
  ),
  colab_data AS MATERIALIZED (
    SELECT c.tarefa_id,
           jsonb_agg(jsonb_build_object(
             'user_id', c.user_id,
             'nome', COALESCE(pd.nome, 'Membro'),
             'avatar_url', pd.avatar_url
           ) ORDER BY COALESCE(pd.nome, 'Membro')) AS colabs
    FROM public.projeto_tarefa_colaboradores c
    JOIN visible_tarefas vt ON vt.id = c.tarefa_id
    LEFT JOIN profiles_data pd ON pd.id = c.user_id
    GROUP BY c.tarefa_id
  ),
  resp_data AS MATERIALIZED (
    SELECT r.tarefa_id,
           jsonb_agg(jsonb_build_object(
             'user_id', r.user_id,
             'nome', COALESCE(pd.nome, 'Membro'),
             'avatar_url', pd.avatar_url,
             'papel', r.papel
           ) ORDER BY COALESCE(r.papel, ''), COALESCE(pd.nome, 'Membro')) AS resps
    FROM public.projeto_tarefa_responsaveis r
    JOIN visible_tarefas vt ON vt.id = r.tarefa_id
    LEFT JOIN profiles_data pd ON pd.id = r.user_id
    GROUP BY r.tarefa_id
  ),
  team AS MATERIALIZED (
    SELECT DISTINCT pm.user_id AS id, pr.nome, pr.avatar_url
    FROM public.projeto_membros pm
    JOIN public.profiles pr ON pr.id = pm.user_id
    WHERE pm.projeto_id = p_projeto_id
  )
  SELECT jsonb_build_object(
    'secoes', COALESCE((
      SELECT jsonb_agg(to_jsonb(vs) ORDER BY vs.ordem)
      FROM visible_secoes vs
    ), '[]'::jsonb),
    'tarefas', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(vt)
        || jsonb_build_object(
          'responsavel', CASE WHEN vt.responsavel_id IS NULL THEN NULL ELSE (
            SELECT jsonb_build_object('id', pd.id, 'nome', pd.nome, 'avatar_url', pd.avatar_url)
            FROM profiles_data pd WHERE pd.id = vt.responsavel_id
          ) END,
          'criador', CASE WHEN vt.criador_id IS NULL THEN NULL ELSE (
            SELECT jsonb_build_object('id', pd.id, 'nome', pd.nome, 'avatar_url', pd.avatar_url)
            FROM profiles_data pd WHERE pd.id = vt.criador_id
          ) END,
          'colaboradores', COALESCE(cd.colabs, '[]'::jsonb),
          'responsaveis', COALESCE(rd.resps, '[]'::jsonb)
        )
        ORDER BY vt.secao_id NULLS LAST, vt.ordem, vt.created_at
      )
      FROM visible_tarefas vt
      LEFT JOIN colab_data cd ON cd.tarefa_id = vt.id
      LEFT JOIN resp_data rd ON rd.tarefa_id = vt.id
    ), '[]'::jsonb),
    'team_members', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome, 'avatar_url', t.avatar_url) ORDER BY t.nome)
      FROM team t
    ), '[]'::jsonb),
    'is_partial_view', false,
    'restrict_to_own', false,
    'total_secoes_projeto', v_total_secoes,
    'total_tarefas_projeto', v_total_tarefas_projeto,
    'visible_tarefas_count', (SELECT COUNT(*) FROM visible_tarefas)
  ) INTO result;

  RETURN result;
END;
$function$;