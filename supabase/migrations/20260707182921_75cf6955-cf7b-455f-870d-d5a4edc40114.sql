-- Extend read policy on projeto_tarefa_acesso_audit so project coordenadores/gestores
-- can see membership audit rows for their own project.
DROP POLICY IF EXISTS "Audit visível para afetado, ator ou admin" ON public.projeto_tarefa_acesso_audit;

CREATE POLICY "Audit visível para afetado, ator, admin ou gestores do projeto"
  ON public.projeto_tarefa_acesso_audit
  FOR SELECT
  TO authenticated
  USING (
    user_afetado_id = (SELECT auth.uid())
    OR ator_id = (SELECT auth.uid())
    OR has_role((SELECT auth.uid()), 'admin'::app_role)
    OR (
      projeto_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.projeto_membros pm
         WHERE pm.projeto_id = projeto_tarefa_acesso_audit.projeto_id
           AND pm.user_id = (SELECT auth.uid())
           AND pm.papel IN ('coordenador','gestor_produto')
      )
    )
  );