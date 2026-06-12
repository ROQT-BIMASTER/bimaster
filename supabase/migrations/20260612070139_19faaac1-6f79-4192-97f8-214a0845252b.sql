-- Migration 5: china_produto_documentos UPDATE — incluir membros do projeto da tarefa vinculada

DROP POLICY IF EXISTS china_doc_update ON public.china_produto_documentos;

CREATE POLICY china_doc_update ON public.china_produto_documentos
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.china_produto_submissoes s
    WHERE s.id = china_produto_documentos.submissao_id
      AND (
        s.created_by = (SELECT auth.uid())
        OR public.has_role((SELECT auth.uid()), 'admin'::app_role)
        OR public.has_role((SELECT auth.uid()), 'supervisor'::app_role)
        OR public.check_user_access((SELECT auth.uid()), 'fabrica')
        OR public.check_user_access((SELECT auth.uid()), 'china')
      )
  )
  OR (
    china_produto_documentos.projeto_tarefa_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.projeto_tarefas pt
      JOIN public.projeto_membros pm ON pm.projeto_id = pt.projeto_id
      WHERE pt.id = china_produto_documentos.projeto_tarefa_id
        AND pm.user_id = (SELECT auth.uid())
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.china_produto_submissoes s
    WHERE s.id = china_produto_documentos.submissao_id
      AND (
        s.created_by = (SELECT auth.uid())
        OR public.has_role((SELECT auth.uid()), 'admin'::app_role)
        OR public.has_role((SELECT auth.uid()), 'supervisor'::app_role)
        OR public.check_user_access((SELECT auth.uid()), 'fabrica')
        OR public.check_user_access((SELECT auth.uid()), 'china')
      )
  )
  OR (
    china_produto_documentos.projeto_tarefa_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.projeto_tarefas pt
      JOIN public.projeto_membros pm ON pm.projeto_id = pt.projeto_id
      WHERE pt.id = china_produto_documentos.projeto_tarefa_id
        AND pm.user_id = (SELECT auth.uid())
    )
  )
);