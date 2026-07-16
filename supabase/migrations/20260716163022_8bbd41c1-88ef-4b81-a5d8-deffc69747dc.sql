DROP FUNCTION IF EXISTS public.get_minhas_tarefas_central();
DROP FUNCTION IF EXISTS public.get_minhas_tarefas_central(integer);
DROP FUNCTION IF EXISTS public.get_minhas_tarefas_central(integer, boolean);

CREATE OR REPLACE FUNCTION public.get_minhas_tarefas_central(
  p_limite_concluidas integer DEFAULT 50,
  p_incluir_criador boolean DEFAULT true
)
RETURNS TABLE(
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
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  papel text,
  ticket_id uuid,
  ticket_protocolo text,
  ticket_status text,
  ticket_sla_status text,
  ticket_prazo_resolucao_em timestamp with time zone,
  ticket_fila_id uuid,
  ticket_fila_nome text,
  ticket_ultima_interacao_em timestamp with time zone,
  ticket_prioridade text,
  ticket_conversa_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
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
        WHEN p_incluir_criador AND t.criador_id = auth.uid()
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
        WHEN p_incluir_criador AND t.criador_id = auth.uid()
        THEN 4
        ELSE 5
      END AS papel_rank
    FROM public.projeto_tarefas t
    WHERE auth.uid() IS NOT NULL
      AND t.excluida_em IS NULL
      AND (
        t.responsavel_id = auth.uid()
        OR (p_incluir_criador AND t.criador_id = auth.uid())
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
    SELECT *
    FROM dedup
    WHERE status IS DISTINCT FROM 'concluida'
  ), concluidas_ranked AS (
    SELECT d.*, ROW_NUMBER() OVER (
      ORDER BY d.data_conclusao DESC NULLS LAST, d.updated_at DESC NULLS LAST, d.created_at DESC NULLS LAST, d.id
    ) AS rn
    FROM dedup d
    WHERE d.status = 'concluida'
  ), concluidas_selecionadas AS (
    SELECT *
    FROM concluidas_ranked
    WHERE p_limite_concluidas IS NULL OR rn <= p_limite_concluidas
  ), final AS (
    SELECT
      a.id, a.titulo, a.descricao, a.status, a.prioridade, a.data_inicio_planejada, a.data_prazo, a.data_conclusao,
      a.projeto_id, a.estagio, a.criador_id, a.visibilidade, a.secao_id, a.ordem, a.parent_tarefa_id,
      a.responsavel_id, a.codigo, a.produto_id, a.created_at, a.updated_at, a.papel_calc
    FROM ativas a
    UNION ALL
    SELECT
      c.id, c.titulo, c.descricao, c.status, c.prioridade, c.data_inicio_planejada, c.data_prazo, c.data_conclusao,
      c.projeto_id, c.estagio, c.criador_id, c.visibilidade, c.secao_id, c.ordem, c.parent_tarefa_id,
      c.responsavel_id, c.codigo, c.produto_id, c.created_at, c.updated_at, c.papel_calc
    FROM concluidas_selecionadas c
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
  LEFT JOIN public.suporte_filas sf ON sf.id = st.fila_id
  ORDER BY
    CASE WHEN f.status = 'concluida' THEN 1 ELSE 0 END ASC,
    CASE WHEN f.status = 'concluida' THEN NULL ELSE f.data_prazo END ASC NULLS LAST,
    CASE WHEN f.status = 'concluida' THEN NULL ELSE f.created_at END ASC,
    CASE WHEN f.status = 'concluida' THEN COALESCE(f.data_conclusao::timestamp with time zone, f.updated_at, f.created_at) ELSE NULL END DESC NULLS LAST,
    f.updated_at DESC NULLS LAST;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_minhas_tarefas_central(integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_minhas_tarefas_central(integer, boolean) TO authenticated;

DROP FUNCTION IF EXISTS public.rpc_minhas_tarefas_stats();
DROP FUNCTION IF EXISTS public.rpc_minhas_tarefas_stats(boolean);

CREATE OR REPLACE FUNCTION public.rpc_minhas_tarefas_stats(
  p_incluir_criador boolean DEFAULT true
)
RETURNS TABLE(
  total bigint,
  ativas bigint,
  concluidas bigint,
  concluidas_30d bigint,
  concluidas_hoje bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH minhas AS (
    SELECT DISTINCT t.id, t.status, t.data_conclusao
    FROM public.projeto_tarefas t
    WHERE auth.uid() IS NOT NULL
      AND t.excluida_em IS NULL
      AND (
        t.responsavel_id = auth.uid()
        OR (p_incluir_criador AND t.criador_id = auth.uid())
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
  )
  SELECT
    count(*)::bigint AS total,
    count(*) FILTER (WHERE status IS DISTINCT FROM 'concluida')::bigint AS ativas,
    count(*) FILTER (WHERE status = 'concluida')::bigint AS concluidas,
    count(*) FILTER (
      WHERE status = 'concluida'
        AND data_conclusao >= ((now() AT TIME ZONE 'America/Sao_Paulo')::date - 30)
    )::bigint AS concluidas_30d,
    count(*) FILTER (
      WHERE status = 'concluida'
        AND data_conclusao = (now() AT TIME ZONE 'America/Sao_Paulo')::date
    )::bigint AS concluidas_hoje
  FROM minhas;
$function$;

REVOKE EXECUTE ON FUNCTION public.rpc_minhas_tarefas_stats(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_minhas_tarefas_stats(boolean) TO authenticated;