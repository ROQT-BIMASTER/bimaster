
-- ========================================================================
-- Onda 1: Saúde do Módulo de Projetos
-- ========================================================================

-- 1) RPC: KPIs de saúde do módulo (admin-only)
CREATE OR REPLACE FUNCTION public.projetos_health_kpis()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_result jsonb;
BEGIN
  IF v_user IS NULL OR NOT public.is_admin(v_user) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'projetos_total', (SELECT COUNT(*) FROM public.projetos),
    'projetos_sem_data_fim', (SELECT COUNT(*) FROM public.projetos WHERE data_fim_alvo IS NULL),
    'projetos_parados_14d', (
      SELECT COUNT(DISTINCT p.id)
      FROM public.projetos p
      WHERE NOT EXISTS (
        SELECT 1 FROM public.projeto_tarefa_atividades a
        WHERE a.projeto_id = p.id AND a.created_at > now() - interval '14 days'
      )
    ),
    'tarefas_total', (SELECT COUNT(*) FROM public.projeto_tarefas WHERE excluida_em IS NULL),
    'tarefas_ativas', (SELECT COUNT(*) FROM public.projeto_tarefas WHERE excluida_em IS NULL AND status <> 'concluida'),
    'tarefas_ativas_sem_prazo', (
      SELECT COUNT(*) FROM public.projeto_tarefas
      WHERE excluida_em IS NULL AND status <> 'concluida' AND data_prazo IS NULL
    ),
    'tarefas_ativas_sem_responsavel', (
      SELECT COUNT(*) FROM public.projeto_tarefas
      WHERE excluida_em IS NULL AND status <> 'concluida' AND responsavel_id IS NULL
    ),
    'tarefas_ativas_sem_responsavel_com_criador', (
      SELECT COUNT(*) FROM public.projeto_tarefas
      WHERE excluida_em IS NULL AND status <> 'concluida'
        AND responsavel_id IS NULL AND criador_id IS NOT NULL
    ),
    'tarefas_atrasadas', (
      SELECT COUNT(*) FROM public.projeto_tarefas
      WHERE excluida_em IS NULL AND status <> 'concluida'
        AND data_prazo IS NOT NULL AND data_prazo < CURRENT_DATE
    ),
    'tarefas_proximas_48h', (
      SELECT COUNT(*) FROM public.projeto_tarefas
      WHERE excluida_em IS NULL AND status <> 'concluida'
        AND data_prazo IS NOT NULL
        AND data_prazo BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '2 days'
    ),
    'comentarios_total', (SELECT COUNT(*) FROM public.projeto_tarefa_comentarios),
    'auditoria_eventos_30d', (
      SELECT COUNT(*) FROM public.projeto_tarefa_atividades
      WHERE created_at > now() - interval '30 days'
    ),
    'gerado_em', now()
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.projetos_health_kpis() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.projetos_health_kpis() TO authenticated;

-- 2) RPC: lista paginada de tarefas ativas sem prazo (admin)
CREATE OR REPLACE FUNCTION public.projetos_tarefas_sem_prazo(p_limit INT DEFAULT 100)
RETURNS TABLE (
  id UUID, projeto_id UUID, projeto_nome TEXT,
  titulo TEXT, status TEXT, criador_id UUID, responsavel_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT t.id, t.projeto_id, p.nome, t.titulo, t.status, t.criador_id, t.responsavel_id, t.created_at
  FROM public.projeto_tarefas t
  JOIN public.projetos p ON p.id = t.projeto_id
  WHERE t.excluida_em IS NULL
    AND t.status <> 'concluida'
    AND t.data_prazo IS NULL
  ORDER BY t.created_at DESC
  LIMIT GREATEST(p_limit, 1);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.projetos_tarefas_sem_prazo(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.projetos_tarefas_sem_prazo(INT) TO authenticated;

-- 3) RPC: lista paginada de tarefas ativas sem responsável (admin)
CREATE OR REPLACE FUNCTION public.projetos_tarefas_sem_responsavel(p_limit INT DEFAULT 100)
RETURNS TABLE (
  id UUID, projeto_id UUID, projeto_nome TEXT,
  titulo TEXT, status TEXT, criador_id UUID, criador_nome TEXT,
  data_prazo DATE, created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT t.id, t.projeto_id, p.nome, t.titulo, t.status, t.criador_id,
         pr.nome, t.data_prazo, t.created_at
  FROM public.projeto_tarefas t
  JOIN public.projetos p ON p.id = t.projeto_id
  LEFT JOIN public.profiles pr ON pr.id = t.criador_id
  WHERE t.excluida_em IS NULL
    AND t.status <> 'concluida'
    AND t.responsavel_id IS NULL
  ORDER BY t.created_at DESC
  LIMIT GREATEST(p_limit, 1);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.projetos_tarefas_sem_responsavel(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.projetos_tarefas_sem_responsavel(INT) TO authenticated;

-- 4) RPC: saneamento em lote — atribuir criador como responsável (admin, dry-run + apply)
CREATE OR REPLACE FUNCTION public.projetos_atribuir_criador_como_responsavel(
  p_apply BOOLEAN DEFAULT FALSE,
  p_projeto_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_apply THEN
    WITH upd AS (
      UPDATE public.projeto_tarefas t
      SET responsavel_id = t.criador_id, updated_at = now()
      WHERE t.excluida_em IS NULL
        AND t.status <> 'concluida'
        AND t.responsavel_id IS NULL
        AND t.criador_id IS NOT NULL
        AND (p_projeto_id IS NULL OR t.projeto_id = p_projeto_id)
        -- garante que o criador ainda é membro do projeto (validate trigger não bloqueia)
        AND EXISTS (
          SELECT 1 FROM public.projeto_membros m
          WHERE m.projeto_id = t.projeto_id AND m.user_id = t.criador_id
        )
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_count FROM upd;
  ELSE
    SELECT COUNT(*) INTO v_count
    FROM public.projeto_tarefas t
    WHERE t.excluida_em IS NULL
      AND t.status <> 'concluida'
      AND t.responsavel_id IS NULL
      AND t.criador_id IS NOT NULL
      AND (p_projeto_id IS NULL OR t.projeto_id = p_projeto_id)
      AND EXISTS (
        SELECT 1 FROM public.projeto_membros m
        WHERE m.projeto_id = t.projeto_id AND m.user_id = t.criador_id
      );
  END IF;

  RETURN jsonb_build_object(
    'aplicado', p_apply,
    'tarefas_afetadas', COALESCE(v_count, 0),
    'projeto_id', p_projeto_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.projetos_atribuir_criador_como_responsavel(BOOLEAN, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.projetos_atribuir_criador_como_responsavel(BOOLEAN, UUID) TO authenticated;
