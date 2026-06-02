-- Unifica acesso ao módulo Projetos: quem acessa o projeto vê seções e tarefas.
-- Remove o subset por projeto_membro_secoes que escondia seções recém-criadas
-- após refresh e bloqueava tarefas criadas nessas seções.

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
  FROM public.projeto_secoes WHERE projeto_id = p_projeto_id;

  SELECT COUNT(*) INTO v_total_tarefas_projeto
  FROM public.projeto_tarefas
  WHERE projeto_id = p_projeto_id AND excluida_em IS NULL;

  WITH visible_secoes AS (
    SELECT s.*
    FROM public.projeto_secoes s
    WHERE s.projeto_id = p_projeto_id
    ORDER BY s.ordem
  ),
  visible_tarefas AS (
    SELECT t.*
    FROM public.projeto_tarefas t
    WHERE t.projeto_id = p_projeto_id
      AND t.excluida_em IS NULL
  ),
  user_ids_set AS (
    SELECT responsavel_id AS uid FROM visible_tarefas WHERE responsavel_id IS NOT NULL
    UNION
    SELECT criador_id FROM visible_tarefas WHERE criador_id IS NOT NULL
    UNION
    SELECT c.user_id FROM public.projeto_tarefa_colaboradores c
      WHERE c.tarefa_id IN (SELECT id FROM visible_tarefas)
    UNION
    SELECT r.user_id FROM public.projeto_tarefa_responsaveis r
      WHERE r.tarefa_id IN (SELECT id FROM visible_tarefas)
  ),
  profiles_data AS (
    SELECT p.id, p.nome, p.avatar_url
    FROM public.profiles p
    WHERE p.id IN (SELECT uid FROM user_ids_set WHERE uid IS NOT NULL)
  ),
  colab_data AS (
    SELECT c.tarefa_id,
           jsonb_agg(jsonb_build_object(
             'user_id', c.user_id,
             'nome', pd.nome,
             'avatar_url', pd.avatar_url
           )) AS colabs
    FROM public.projeto_tarefa_colaboradores c
    LEFT JOIN profiles_data pd ON pd.id = c.user_id
    WHERE c.tarefa_id IN (SELECT id FROM visible_tarefas)
    GROUP BY c.tarefa_id
  ),
  resp_data AS (
    SELECT r.tarefa_id,
           jsonb_agg(jsonb_build_object(
             'user_id', r.user_id,
             'nome', pd.nome,
             'avatar_url', pd.avatar_url,
             'papel', r.papel
           )) AS resps
    FROM public.projeto_tarefa_responsaveis r
    LEFT JOIN profiles_data pd ON pd.id = r.user_id
    WHERE r.tarefa_id IN (SELECT id FROM visible_tarefas)
    GROUP BY r.tarefa_id
  ),
  team AS (
    SELECT DISTINCT pm.user_id AS id, pr.nome, pr.avatar_url
    FROM public.projeto_membros pm
    JOIN public.profiles pr ON pr.id = pm.user_id
    WHERE pm.projeto_id = p_projeto_id
  )
  SELECT jsonb_build_object(
    'secoes', COALESCE((SELECT jsonb_agg(to_jsonb(vs)) FROM visible_secoes vs), '[]'::jsonb),
    'tarefas', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(vt)
        || jsonb_build_object(
          'responsavel', (
            SELECT jsonb_build_object('id', pd.id, 'nome', pd.nome, 'avatar_url', pd.avatar_url)
            FROM profiles_data pd WHERE pd.id = vt.responsavel_id
          ),
          'criador', (
            SELECT jsonb_build_object('id', pd.id, 'nome', pd.nome, 'avatar_url', pd.avatar_url)
            FROM profiles_data pd WHERE pd.id = vt.criador_id
          ),
          'colaboradores', COALESCE((SELECT colabs FROM colab_data cd WHERE cd.tarefa_id = vt.id), '[]'::jsonb),
          'responsaveis', COALESCE((SELECT resps FROM resp_data rd WHERE rd.tarefa_id = vt.id), '[]'::jsonb)
        )
      )
      FROM visible_tarefas vt
    ), '[]'::jsonb),
    'team_members', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome, 'avatar_url', t.avatar_url)) FROM team t), '[]'::jsonb),
    'is_partial_view', false,
    'restrict_to_own', false,
    'total_secoes_projeto', v_total_secoes,
    'total_tarefas_projeto', v_total_tarefas_projeto,
    'visible_tarefas_count', (SELECT COUNT(*) FROM visible_tarefas)
  ) INTO result;

  RETURN result;
END;
$function$;