-- Restrict Central de Trabalho to tasks where user is responsavel
-- OR has explicit release per section/task
CREATE OR REPLACE FUNCTION public.get_minhas_tarefas_central()
RETURNS TABLE (
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
  codigo text,
  produto_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  papel text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  WITH uid AS (SELECT auth.uid() AS u),
  minhas AS (
    SELECT
      t.*,
      CASE
        WHEN t.responsavel_id = (SELECT u FROM uid) THEN 'responsavel'
        WHEN EXISTS (
          SELECT 1 FROM public.projeto_tarefa_colaboradores c
          WHERE c.tarefa_id = t.id AND c.user_id = (SELECT u FROM uid)
        ) THEN 'colaborador'
        ELSE 'liberado'
      END AS papel_calc,
      CASE
        WHEN t.responsavel_id = (SELECT u FROM uid) THEN 1
        WHEN EXISTS (
          SELECT 1 FROM public.projeto_tarefa_colaboradores c
          WHERE c.tarefa_id = t.id AND c.user_id = (SELECT u FROM uid)
        ) THEN 2
        ELSE 3
      END AS papel_rank
    FROM public.projeto_tarefas t
    WHERE (SELECT u FROM uid) IS NOT NULL
      AND t.excluida_em IS NULL
      AND (
        -- (a) Direct responsible
        t.responsavel_id = (SELECT u FROM uid)
        -- (b) Explicit collaborator on the task
        OR EXISTS (
          SELECT 1
          FROM public.projeto_tarefa_colaboradores c
          WHERE c.tarefa_id = t.id
            AND c.user_id = (SELECT u FROM uid)
        )
        -- (c) Project member with section release covering the task's section
        --     (or member with no section restriction = full project access)
        OR (
          t.secao_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.projeto_membros pm
            WHERE pm.projeto_id = t.projeto_id
              AND pm.user_id = (SELECT u FROM uid)
              AND (
                -- coordinator sees everything in the project
                pm.papel = 'coordenador'
                -- explicit section release
                OR EXISTS (
                  SELECT 1
                  FROM public.projeto_membro_secoes pms
                  WHERE pms.membro_id = pm.id
                    AND pms.secao_id = t.secao_id
                )
                -- member without any section restriction = full project access
                OR NOT EXISTS (
                  SELECT 1
                  FROM public.projeto_membro_secoes pms_any
                  WHERE pms_any.membro_id = pm.id
                )
              )
          )
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
    COALESCE(p.nome, 'Sem projeto') AS projeto_nome,
    COALESCE(p.cor, '#6366f1') AS projeto_cor,
    d.estagio,
    d.criador_id,
    d.visibilidade,
    d.secao_id,
    s.nome AS secao_nome,
    COALESCE(d.ordem, 0) AS ordem,
    d.parent_tarefa_id,
    d.responsavel_id,
    d.codigo,
    d.produto_id,
    d.created_at,
    d.updated_at,
    d.papel_calc AS papel
  FROM dedup d
  LEFT JOIN public.projetos p ON p.id = d.projeto_id
  LEFT JOIN public.projeto_secoes s ON s.id = d.secao_id
  ORDER BY d.data_prazo ASC NULLS LAST, d.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_minhas_tarefas_central() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_minhas_tarefas_central() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_minhas_tarefas_central() TO authenticated;