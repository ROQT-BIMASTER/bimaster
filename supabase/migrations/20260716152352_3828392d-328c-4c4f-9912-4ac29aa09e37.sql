
CREATE OR REPLACE FUNCTION public.get_minhas_tarefas_central(p_limite_concluidas int DEFAULT NULL)
 RETURNS TABLE(id uuid, titulo text, descricao text, status text, prioridade text, data_inicio_planejada date, data_prazo date, data_conclusao date, projeto_id uuid, projeto_nome text, projeto_cor text, estagio text, criador_id uuid, visibilidade text, secao_id uuid, secao_nome text, ordem integer, parent_tarefa_id uuid, responsavel_id uuid, responsavel_nome text, responsavel_avatar_url text, codigo text, produto_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, papel text, ticket_id uuid, ticket_protocolo text, ticket_status text, ticket_sla_status text, ticket_prazo_resolucao_em timestamp with time zone, ticket_fila_id uuid, ticket_fila_nome text, ticket_ultima_interacao_em timestamp with time zone, ticket_prioridade text, ticket_conversa_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH minhas AS (
    SELECT
      t.*,
      CASE
        WHEN t.responsavel_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.projeto_tarefa_responsaveis r
            WHERE r.tarefa_id = t.id
              AND r.user_id = auth.uid()
          )
        THEN 'responsavel'
        WHEN EXISTS (
          SELECT 1
          FROM public.projeto_tarefa_colaboradores c
          WHERE c.tarefa_id = t.id
            AND c.user_id = auth.uid()
        )
        THEN 'colaborador'
        WHEN EXISTS (
          SELECT 1
          FROM public.projeto_tarefa_seguidores s
          WHERE s.tarefa_id = t.id
            AND s.user_id = auth.uid()
        )
        THEN 'seguidor'
        WHEN t.criador_id = auth.uid()
        THEN 'criador'
        ELSE 'colaborador'
      END AS papel_calc,
      CASE
        WHEN t.responsavel_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.projeto_tarefa_responsaveis r
            WHERE r.tarefa_id = t.id
              AND r.user_id = auth.uid()
          )
        THEN 1
        WHEN EXISTS (
          SELECT 1
          FROM public.projeto_tarefa_colaboradores c
          WHERE c.tarefa_id = t.id
            AND c.user_id = auth.uid()
        )
        THEN 2
        WHEN EXISTS (
          SELECT 1
          FROM public.projeto_tarefa_seguidores s
          WHERE s.tarefa_id = t.id
            AND s.user_id = auth.uid()
        )
        THEN 3
        WHEN t.criador_id = auth.uid()
        THEN 4
        ELSE 5
      END AS papel_rank
    FROM public.projeto_tarefas t
    WHERE auth.uid() IS NOT NULL
      AND t.excluida_em IS NULL
      AND (
        t.responsavel_id = auth.uid()
        OR t.criador_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.projeto_tarefa_responsaveis r
          WHERE r.tarefa_id = t.id
            AND r.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.projeto_tarefa_colaboradores c
          WHERE c.tarefa_id = t.id
            AND c.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.projeto_tarefa_seguidores s
          WHERE s.tarefa_id = t.id
            AND s.user_id = auth.uid()
        )
      )
  ), dedup AS (
    SELECT DISTINCT ON (m.id) m.*
    FROM minhas m
    ORDER BY m.id, m.papel_rank
  ), ativas AS (
    SELECT * FROM dedup WHERE status <> 'concluida'
  ), concluidas_ranked AS (
    SELECT d.*, ROW_NUMBER() OVER (
      ORDER BY d.data_conclusao DESC NULLS LAST, d.updated_at DESC NULLS LAST, d.id
    ) AS rn
    FROM dedup d
    WHERE d.status = 'concluida'
  ), concluidas_selecionadas AS (
    SELECT * FROM concluidas_ranked
    WHERE p_limite_concluidas IS NULL OR rn <= p_limite_concluidas
  ), final AS (
    SELECT id, titulo, descricao, status, prioridade, data_inicio_planejada, data_prazo, data_conclusao,
           projeto_id, estagio, criador_id, visibilidade, secao_id, ordem, parent_tarefa_id,
           responsavel_id, codigo, produto_id, created_at, updated_at, papel_calc
    FROM ativas
    UNION ALL
    SELECT id, titulo, descricao, status, prioridade, data_inicio_planejada, data_prazo, data_conclusao,
           projeto_id, estagio, criador_id, visibilidade, secao_id, ordem, parent_tarefa_id,
           responsavel_id, codigo, produto_id, created_at, updated_at, papel_calc
    FROM concluidas_selecionadas
  )
  SELECT
    f.id,
    f.titulo,
    f.descricao,
    f.status,
    f.prioridade,
    f.data_inicio_planejada,
    f.data_prazo,
    f.data_conclusao,
    f.projeto_id,
    COALESCE(p.nome, 'Sem projeto'),
    COALESCE(p.cor, '#6366f1'),
    f.estagio,
    f.criador_id,
    f.visibilidade,
    f.secao_id,
    s.nome,
    COALESCE(f.ordem, 0),
    f.parent_tarefa_id,
    f.responsavel_id,
    pr.nome,
    pr.avatar_url,
    f.codigo,
    f.produto_id,
    f.created_at,
    f.updated_at,
    f.papel_calc,
    st.id,
    st.protocolo,
    st.status,
    st.sla_status,
    st.prazo_resolucao_em,
    st.fila_id,
    sf.nome,
    st.ultima_interacao_em,
    st.prioridade,
    st.conversa_id
  FROM final f
  LEFT JOIN public.projetos p ON p.id = f.projeto_id
  LEFT JOIN public.projeto_secoes s ON s.id = f.secao_id
  LEFT JOIN public.profiles pr ON pr.id = f.responsavel_id
  LEFT JOIN public.suporte_tickets st ON st.projeto_tarefa_id = f.id
  LEFT JOIN public.suporte_filas sf ON sf.id = f.id AND FALSE  -- placeholder to keep join shape
  LEFT JOIN public.suporte_filas sf2 ON sf2.id = st.fila_id
  ORDER BY
    CASE WHEN f.status = 'concluida' THEN 1 ELSE 0 END ASC,
    CASE WHEN f.status = 'concluida' THEN NULL ELSE f.data_prazo END ASC NULLS LAST,
    CASE WHEN f.status = 'concluida' THEN NULL ELSE f.created_at END ASC,
    CASE WHEN f.status = 'concluida' THEN COALESCE(f.data_conclusao::timestamp with time zone, f.updated_at, f.created_at) ELSE NULL END DESC NULLS LAST,
    f.updated_at DESC NULLS LAST;
$function$;

GRANT EXECUTE ON FUNCTION public.get_minhas_tarefas_central(int) TO authenticated;
