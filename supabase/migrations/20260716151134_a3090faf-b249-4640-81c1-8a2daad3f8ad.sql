CREATE OR REPLACE FUNCTION public.get_minhas_tarefas_central()
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
  )
  SELECT
    d.id,
    d.titulo,
    d.descricao,
    d.status,
    d.prioridade,
    d.data_inicio_planejada,
    d.data_prazo,
    d.data_conclusao,
    d.projeto_id,
    COALESCE(p.nome, 'Sem projeto'),
    COALESCE(p.cor, '#6366f1'),
    d.estagio,
    d.criador_id,
    d.visibilidade,
    d.secao_id,
    s.nome,
    COALESCE(d.ordem, 0),
    d.parent_tarefa_id,
    d.responsavel_id,
    pr.nome,
    pr.avatar_url,
    d.codigo,
    d.produto_id,
    d.created_at,
    d.updated_at,
    d.papel_calc,
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
  FROM dedup d
  LEFT JOIN public.projetos p ON p.id = d.projeto_id
  LEFT JOIN public.projeto_secoes s ON s.id = d.secao_id
  LEFT JOIN public.profiles pr ON pr.id = d.responsavel_id
  LEFT JOIN public.suporte_tickets st ON st.projeto_tarefa_id = d.id
  LEFT JOIN public.suporte_filas sf ON sf.id = st.fila_id
  ORDER BY
    CASE WHEN d.status = 'concluida' THEN 1 ELSE 0 END ASC,
    CASE WHEN d.status = 'concluida' THEN NULL ELSE d.data_prazo END ASC NULLS LAST,
    CASE WHEN d.status = 'concluida' THEN NULL ELSE d.created_at END ASC,
    CASE WHEN d.status = 'concluida' THEN COALESCE(d.data_conclusao::timestamp with time zone, d.updated_at, d.created_at) ELSE NULL END DESC NULLS LAST,
    d.updated_at DESC NULLS LAST;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_minhas_tarefas_stats()
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
    SELECT t.id, t.status, t.data_conclusao
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
  )
  SELECT
    count(*)::bigint AS total,
    count(*) FILTER (WHERE status <> 'concluida')::bigint AS ativas,
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