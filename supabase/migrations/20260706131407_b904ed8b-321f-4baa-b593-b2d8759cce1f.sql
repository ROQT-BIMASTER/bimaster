
CREATE OR REPLACE FUNCTION public.rpc_minhas_tarefas_stats()
 RETURNS TABLE(
   total bigint,
   ativas bigint,
   concluidas bigint,
   concluidas_30d bigint,
   concluidas_hoje bigint
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH minhas AS (
    SELECT DISTINCT t.id, t.status, t.data_conclusao
    FROM public.projeto_tarefas t
    WHERE auth.uid() IS NOT NULL AND t.excluida_em IS NULL
      AND (
        t.responsavel_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.projeto_tarefa_responsaveis r WHERE r.tarefa_id = t.id AND r.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.projeto_tarefa_colaboradores c WHERE c.tarefa_id = t.id AND c.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.projeto_tarefa_seguidores  s WHERE s.tarefa_id = t.id AND s.user_id = auth.uid())
      )
  )
  SELECT
    count(*)::bigint AS total,
    count(*) FILTER (WHERE status <> 'concluida')::bigint AS ativas,
    count(*) FILTER (WHERE status =  'concluida')::bigint AS concluidas,
    count(*) FILTER (
      WHERE status = 'concluida'
        AND data_conclusao >= (now() AT TIME ZONE 'America/Sao_Paulo')::date - INTERVAL '30 days'
    )::bigint AS concluidas_30d,
    count(*) FILTER (
      WHERE status = 'concluida'
        AND data_conclusao = (now() AT TIME ZONE 'America/Sao_Paulo')::date
    )::bigint AS concluidas_hoje
  FROM minhas;
$function$;

REVOKE ALL ON FUNCTION public.rpc_minhas_tarefas_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_minhas_tarefas_stats() TO authenticated;
