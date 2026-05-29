-- 1) Política de criação de projetos: autenticado + criador_id = auth.uid()
DROP POLICY IF EXISTS "Usuários ativos podem criar projetos próprios" ON public.projetos;
DROP POLICY IF EXISTS "Authenticated users can insert projetos" ON public.projetos;

CREATE POLICY "Authenticated users can insert own projetos"
ON public.projetos
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
  AND criador_id = (SELECT auth.uid())
);

-- 2) Permitir que o criador do projeto vincule departamentos
DROP POLICY IF EXISTS "Creator or admin manage projeto_departamentos" ON public.projeto_departamentos;

CREATE POLICY "Creator or admin manage projeto_departamentos"
ON public.projeto_departamentos
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.projetos p
    WHERE p.id = projeto_departamentos.projeto_id
      AND p.criador_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Creator or admin delete projeto_departamentos"
ON public.projeto_departamentos
FOR DELETE
TO authenticated
USING (
  public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.projetos p
    WHERE p.id = projeto_departamentos.projeto_id
      AND p.criador_id = (SELECT auth.uid())
  )
);