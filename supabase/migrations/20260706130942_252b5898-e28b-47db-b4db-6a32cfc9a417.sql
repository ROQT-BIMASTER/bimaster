
CREATE OR REPLACE FUNCTION public.get_minhas_tarefas_central()
 RETURNS TABLE(id uuid, titulo text, descricao text, status text, prioridade text, data_inicio_planejada date, data_prazo date, data_conclusao date, projeto_id uuid, projeto_nome text, projeto_cor text, estagio text, criador_id uuid, visibilidade text, secao_id uuid, secao_nome text, ordem integer, parent_tarefa_id uuid, responsavel_id uuid, responsavel_nome text, responsavel_avatar_url text, codigo text, produto_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, papel text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH minhas AS (
    SELECT t.*,
      CASE
        WHEN t.responsavel_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.projeto_tarefa_responsaveis r WHERE r.tarefa_id = t.id AND r.user_id = auth.uid())
        THEN 'responsavel'
        WHEN EXISTS (SELECT 1 FROM public.projeto_tarefa_colaboradores c WHERE c.tarefa_id = t.id AND c.user_id = auth.uid())
        THEN 'colaborador'
        WHEN EXISTS (SELECT 1 FROM public.projeto_tarefa_seguidores s WHERE s.tarefa_id = t.id AND s.user_id = auth.uid())
        THEN 'seguidor'
        ELSE 'colaborador'
      END AS papel_calc,
      CASE
        WHEN t.responsavel_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.projeto_tarefa_responsaveis r WHERE r.tarefa_id = t.id AND r.user_id = auth.uid())
        THEN 1
        WHEN EXISTS (SELECT 1 FROM public.projeto_tarefa_colaboradores c WHERE c.tarefa_id = t.id AND c.user_id = auth.uid())
        THEN 2
        WHEN EXISTS (SELECT 1 FROM public.projeto_tarefa_seguidores s WHERE s.tarefa_id = t.id AND s.user_id = auth.uid())
        THEN 3
        ELSE 4
      END AS papel_rank
    FROM public.projeto_tarefas t
    WHERE auth.uid() IS NOT NULL AND t.excluida_em IS NULL
      AND (
        t.responsavel_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.projeto_tarefa_responsaveis r WHERE r.tarefa_id = t.id AND r.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.projeto_tarefa_colaboradores c WHERE c.tarefa_id = t.id AND c.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.projeto_tarefa_seguidores s WHERE s.tarefa_id = t.id AND s.user_id = auth.uid())
      )
  ), dedup AS (SELECT DISTINCT ON (m.id) m.* FROM minhas m ORDER BY m.id, m.papel_rank)
  SELECT d.id, d.titulo, d.descricao, d.status, d.prioridade,
    d.data_inicio_planejada, d.data_prazo, d.data_conclusao,
    d.projeto_id, COALESCE(p.nome, 'Sem projeto'), COALESCE(p.cor, '#6366f1'),
    d.estagio, d.criador_id, d.visibilidade, d.secao_id, s.nome,
    COALESCE(d.ordem, 0), d.parent_tarefa_id, d.responsavel_id,
    pr.nome, pr.avatar_url, d.codigo, d.produto_id, d.created_at, d.updated_at, d.papel_calc
  FROM dedup d
  LEFT JOIN public.projetos p ON p.id = d.projeto_id
  LEFT JOIN public.projeto_secoes s ON s.id = d.secao_id
  LEFT JOIN public.profiles pr ON pr.id = d.responsavel_id
  -- Correção 2026-07-06: usuários com histórico > 1000 tarefas (ex.: Paloma tem 1746)
  -- eram cortados pelo limite default do PostgREST (1000 linhas). Com a ordenação
  -- antiga (data_prazo ASC NULLS LAST), as concluídas antigas ocupavam a fatia e as
  -- ativas + concluídas recentes ficavam fora do payload. Agora ordenamos:
  --   1) status ativos primeiro (garante 100% do backlog visível),
  --   2) concluídas por data_conclusao DESC (recentes vêm antes das antigas),
  --   3) tie-breakers estáveis por data_prazo e created_at.
  ORDER BY
    (d.status = 'concluida'),                 -- false (ativas) antes de true (concluídas)
    CASE WHEN d.status = 'concluida'
         THEN d.data_conclusao END DESC NULLS LAST,
    d.data_prazo ASC NULLS LAST,
    d.created_at ASC;
$function$;
