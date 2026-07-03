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
      t.data_proxima_acao,
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