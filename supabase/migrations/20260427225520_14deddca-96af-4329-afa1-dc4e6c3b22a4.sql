-- Permitir que admins e gerentes também gerenciem visibilidade de seções dos membros
DROP POLICY IF EXISTS "Coordinators manage section assignments" ON public.projeto_membro_secoes;
DROP POLICY IF EXISTS "Coordinators delete section assignments" ON public.projeto_membro_secoes;

CREATE POLICY "Manage section assignments"
ON public.projeto_membro_secoes
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR EXISTS (
    SELECT 1
    FROM public.projeto_membros pm
    JOIN public.projeto_membros coord ON coord.projeto_id = pm.projeto_id
    WHERE pm.id = projeto_membro_secoes.membro_id
      AND coord.user_id = auth.uid()
      AND coord.papel IN ('coordenador','gestor_produto')
  )
);

CREATE POLICY "Delete section assignments"
ON public.projeto_membro_secoes
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR EXISTS (
    SELECT 1
    FROM public.projeto_membros pm
    JOIN public.projeto_membros coord ON coord.projeto_id = pm.projeto_id
    WHERE pm.id = projeto_membro_secoes.membro_id
      AND coord.user_id = auth.uid()
      AND coord.papel IN ('coordenador','gestor_produto')
  )
);