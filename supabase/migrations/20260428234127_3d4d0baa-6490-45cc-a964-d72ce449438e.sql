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
  WITH minhas AS (
    SELECT
      t.*,
      CASE
        WHEN t.responsavel_id = auth.uid() THEN 'responsavel'
        WHEN t.criador_id = auth.uid() THEN 'criador'
        ELSE 'colaborador'
      END AS papel_calc,
      CASE
        WHEN t.responsavel_id = auth.uid() THEN 1
        WHEN t.criador_id = auth.uid() THEN 2
        ELSE 3
      END AS papel_rank
    FROM public.projeto_tarefas t
    WHERE auth.uid() IS NOT NULL
      AND t.excluida_em IS NULL
      AND (
        t.responsavel_id = auth.uid()
        OR t.criador_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.projeto_tarefa_colaboradores c
          WHERE c.tarefa_id = t.id
            AND c.user_id = auth.uid()
        )
      )
  ), dedup AS (
    SELECT DISTINCT ON (m.id)
      m.*
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
GRANT EXECUTE ON FUNCTION public.get_minhas_tarefas_central() TO authenticated;

DROP POLICY IF EXISTS "Users can view own task collaborator links" ON public.projeto_tarefa_colaboradores;
CREATE POLICY "Users can view own task collaborator links"
ON public.projeto_tarefa_colaboradores
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.user_can_access_secao(_user_id uuid, _secao_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _user_id IS NOT NULL AND (
    EXISTS (
      SELECT 1
      FROM public.projeto_secoes ps
      JOIN public.projeto_membros pm ON pm.projeto_id = ps.projeto_id
      WHERE ps.id = _secao_id
        AND pm.user_id = _user_id
        AND pm.papel = 'coordenador'
    ) OR EXISTS (
      SELECT 1
      FROM public.projeto_secoes ps
      JOIN public.projetos p ON p.id = ps.projeto_id
      WHERE ps.id = _secao_id
        AND p.criador_id = _user_id
    ) OR EXISTS (
      SELECT 1
      FROM public.projeto_membro_secoes pms
      JOIN public.projeto_membros pm ON pm.id = pms.membro_id
      WHERE pms.secao_id = _secao_id
        AND pm.user_id = _user_id
    ) OR EXISTS (
      SELECT 1
      FROM public.projeto_secoes ps
      JOIN public.projeto_membros pm ON pm.projeto_id = ps.projeto_id
      WHERE ps.id = _secao_id
        AND pm.user_id = _user_id
        AND NOT EXISTS (
          SELECT 1
          FROM public.projeto_membro_secoes pms_any
          WHERE pms_any.membro_id = pm.id
        )
    ) OR EXISTS (
      SELECT 1
      FROM public.projeto_tarefas t
      WHERE t.secao_id = _secao_id
        AND t.excluida_em IS NULL
        AND (
          t.responsavel_id = _user_id
          OR t.criador_id = _user_id
          OR EXISTS (
            SELECT 1
            FROM public.projeto_tarefa_colaboradores c
            WHERE c.tarefa_id = t.id
              AND c.user_id = _user_id
          )
        )
    ) OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.role = 'admin'
    )
  )
$function$;

REVOKE ALL ON FUNCTION public.user_can_access_secao(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_access_secao(uuid, uuid) TO authenticated;