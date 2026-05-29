DROP POLICY IF EXISTS "Authenticated users can insert projetos" ON public.projetos;
DROP POLICY IF EXISTS "Usuários ativos podem criar projetos próprios" ON public.projetos;

CREATE POLICY "Usuários ativos podem criar projetos próprios"
ON public.projetos
FOR INSERT
TO authenticated
WITH CHECK (
  criador_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = (SELECT auth.uid())
      AND COALESCE(pr.aprovado, false) = true
      AND COALESCE(pr.status, '') = 'ativo'
  )
);