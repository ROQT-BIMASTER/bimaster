
-- =====================================================================
-- get_projeto_tarefas_v2
-- Retorna tarefas + seções + team members + flag de visão parcial
-- em uma única chamada, replicando as regras de visibilidade aplicadas
-- hoje em useProjetoTarefas (client-side).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_projeto_tarefas_v2(p_projeto_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_membro_id uuid;
  v_papel text;
  v_allowed_secao_ids uuid[];
  v_restrict_to_own boolean := false;
  v_is_partial_view boolean := false;
  v_total_secoes int;
  v_total_tarefas_projeto int;
  v_can_access boolean := false;
  result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Verifica se usuário pode acessar o projeto via RLS standard:
  -- admin, criador ou membro
  SELECT EXISTS (
    SELECT 1 FROM public.projetos p
    WHERE p.id = p_projeto_id
      AND (
        p.criado_por = v_user_id
        OR public.has_role(v_user_id, 'admin'::app_role)
        OR EXISTS (
          SELECT 1 FROM public.projeto_membros pm
          WHERE pm.projeto_id = p_projeto_id AND pm.user_id = v_user_id
        )
      )
  ) INTO v_can_access;

  IF NOT v_can_access THEN
    RAISE EXCEPTION 'Sem permissão para acessar este projeto';
  END IF;

  -- Detecta papel do membro
  SELECT id, papel INTO v_membro_id, v_papel
  FROM public.projeto_membros
  WHERE projeto_id = p_projeto_id AND user_id = v_user_id
  LIMIT 1;

  -- Coordenadores, gestores, criadores e admins veem tudo
  IF v_membro_id IS NULL
     OR v_papel IN ('coordenador', 'gestor_produto')
     OR public.has_role(v_user_id, 'admin'::app_role)
     OR EXISTS (SELECT 1 FROM public.projetos WHERE id = p_projeto_id AND criado_por = v_user_id)
  THEN
    v_restrict_to_own := false;
    v_allowed_secao_ids := NULL; -- todas
  ELSE
    v_restrict_to_own := true;
    SELECT array_agg(secao_id) INTO v_allowed_secao_ids
    FROM public.projeto_membro_secoes
    WHERE membro_id = v_membro_id;
    -- 0 atribuições = todas
    IF v_allowed_secao_ids IS NULL OR array_length(v_allowed_secao_ids, 1) IS NULL THEN
      v_allowed_secao_ids := NULL;
    END IF;
  END IF;

  -- Total de seções e tarefas do projeto (para detectar visão parcial)
  SELECT COUNT(*) INTO v_total_secoes
  FROM public.projeto_secoes WHERE projeto_id = p_projeto_id;

  SELECT COUNT(*) INTO v_total_tarefas_projeto
  FROM public.projeto_tarefas
  WHERE projeto_id = p_projeto_id AND excluida_em IS NULL;

  -- Build response
  WITH visible_secoes AS (
    SELECT s.*
    FROM public.projeto_secoes s
    WHERE s.projeto_id = p_projeto_id
      AND (v_allowed_secao_ids IS NULL OR s.id = ANY(v_allowed_secao_ids))
    ORDER BY s.ordem
  ),
  base_tarefas AS (
    SELECT t.*
    FROM public.projeto_tarefas t
    WHERE t.projeto_id = p_projeto_id
      AND t.excluida_em IS NULL
      AND (v_allowed_secao_ids IS NULL OR t.secao_id = ANY(v_allowed_secao_ids))
  ),
  -- Aplicar restrictToOwn: tarefas onde usuário está envolvido (responsavel/criador/colaborador)
  -- + subtarefas de pais visíveis
  involved_ids AS (
    SELECT id FROM base_tarefas bt
    WHERE NOT v_restrict_to_own
       OR bt.responsavel_id = v_user_id
       OR bt.criador_id = v_user_id
       OR EXISTS (SELECT 1 FROM public.projeto_tarefa_colaboradores c
                  WHERE c.tarefa_id = bt.id AND c.user_id = v_user_id)
  ),
  visible_ids AS (
    SELECT id FROM involved_ids
    UNION
    SELECT bt.id FROM base_tarefas bt
    WHERE bt.parent_tarefa_id IN (SELECT id FROM involved_ids)
  ),
  visible_tarefas AS (
    SELECT bt.* FROM base_tarefas bt
    WHERE bt.id IN (SELECT id FROM visible_ids)
  ),
  -- Profiles
  user_ids_set AS (
    SELECT responsavel_id AS uid FROM visible_tarefas WHERE responsavel_id IS NOT NULL
    UNION
    SELECT criador_id FROM visible_tarefas WHERE criador_id IS NOT NULL
    UNION
    SELECT c.user_id FROM public.projeto_tarefa_colaboradores c
    WHERE c.tarefa_id IN (SELECT id FROM visible_tarefas)
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
  produto_ids_set AS (
    SELECT DISTINCT produto_id FROM visible_tarefas WHERE produto_id IS NOT NULL
  ),
  produto_data AS (
    SELECT fp.id, fp.foto_url, fp.tipo, fp.nome
    FROM public.fabrica_produtos fp
    WHERE fp.id IN (SELECT produto_id FROM produto_ids_set)
  ),
  link_produtos_raw AS (
    SELECT ltp.tarefa_id, ltp.produto_id
    FROM public.projeto_tarefa_produtos ltp
    WHERE ltp.tarefa_id IN (SELECT id FROM visible_tarefas)
  ),
  link_produto_info AS (
    SELECT fp.id, fp.nome, fp.foto_url, fp.codigo
    FROM public.fabrica_produtos fp
    WHERE fp.id IN (SELECT DISTINCT produto_id FROM link_produtos_raw)
  ),
  link_produtos_data AS (
    SELECT lpr.tarefa_id,
           jsonb_agg(jsonb_build_object(
             'id', lpi.id,
             'nome', lpi.nome,
             'foto_url', lpi.foto_url,
             'codigo', lpi.codigo
           )) AS produtos
    FROM link_produtos_raw lpr
    LEFT JOIN link_produto_info lpi ON lpi.id = lpr.produto_id
    WHERE lpi.id IS NOT NULL
    GROUP BY lpr.tarefa_id
  ),
  processo_data AS (
    SELECT DISTINCT ON (pp.produto_ref_id) pp.produto_ref_id, pp.numero_processo
    FROM public.product_process pp
    WHERE pp.produto_ref_id IN (SELECT produto_id FROM produto_ids_set)
      AND pp.numero_processo IS NOT NULL
    ORDER BY pp.produto_ref_id, pp.created_at DESC
  ),
  team_members_data AS (
    SELECT DISTINCT p.id, p.nome, p.avatar_url
    FROM public.projeto_membros pm
    JOIN public.profiles p ON p.id = pm.user_id
    WHERE pm.projeto_id = p_projeto_id
    ORDER BY p.nome
  )
  SELECT jsonb_build_object(
    'is_partial_view',
      v_restrict_to_own
      OR (v_allowed_secao_ids IS NOT NULL)
      OR ((SELECT COUNT(*) FROM visible_tarefas) < v_total_tarefas_projeto),
    'restrict_to_own', v_restrict_to_own,
    'allowed_secao_ids', to_jsonb(v_allowed_secao_ids),
    'total_secoes_projeto', v_total_secoes,
    'total_tarefas_projeto', v_total_tarefas_projeto,
    'visible_tarefas_count', (SELECT COUNT(*) FROM visible_tarefas),
    'secoes', COALESCE((SELECT jsonb_agg(to_jsonb(vs.*) ORDER BY vs.ordem) FROM visible_secoes vs), '[]'::jsonb),
    'tarefas', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(vt.*) ||
        jsonb_build_object(
          'responsavel', CASE WHEN vt.responsavel_id IS NOT NULL THEN
            (SELECT to_jsonb(pd) FROM profiles_data pd WHERE pd.id = vt.responsavel_id)
            ELSE NULL END,
          'criador', CASE WHEN vt.criador_id IS NOT NULL THEN
            (SELECT to_jsonb(pd) FROM profiles_data pd WHERE pd.id = vt.criador_id)
            ELSE NULL END,
          'colaboradores', COALESCE((SELECT colabs FROM colab_data cd WHERE cd.tarefa_id = vt.id), '[]'::jsonb),
          'produto_foto_url', CASE WHEN vt.produto_id IS NOT NULL THEN
            (SELECT foto_url FROM produto_data pdt WHERE pdt.id = vt.produto_id) ELSE NULL END,
          'produto_tipo', CASE WHEN vt.produto_id IS NOT NULL THEN
            (SELECT tipo FROM produto_data pdt WHERE pdt.id = vt.produto_id) ELSE NULL END,
          'produto_nome', CASE WHEN vt.produto_id IS NOT NULL THEN
            (SELECT nome FROM produto_data pdt WHERE pdt.id = vt.produto_id) ELSE NULL END,
          'numero_processo', CASE WHEN vt.produto_id IS NOT NULL THEN
            (SELECT numero_processo FROM processo_data pp WHERE pp.produto_ref_id = vt.produto_id) ELSE NULL END,
          'linked_produtos', COALESCE((SELECT produtos FROM link_produtos_data lpd WHERE lpd.tarefa_id = vt.id), '[]'::jsonb)
        )
        ORDER BY vt.ordem
      )
      FROM visible_tarefas vt
    ), '[]'::jsonb),
    'team_members', COALESCE((SELECT jsonb_agg(to_jsonb(tm)) FROM team_members_data tm), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_projeto_tarefas_v2(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_projeto_tarefas_v2(uuid) TO authenticated;
