ALTER TABLE public.projeto_membros
  DROP CONSTRAINT IF EXISTS projeto_membros_papel_check;

ALTER TABLE public.projeto_membros
  ADD CONSTRAINT projeto_membros_papel_check
  CHECK (papel IN (
    'coordenador',
    'gestor_produto',
    'regulatorio',
    'design',
    'controle_arte',
    'admin_cofre',
    'diretoria',
    'gerente',
    'membro'
  ));

DROP POLICY IF EXISTS "Update project members" ON public.projeto_membros;

CREATE POLICY "Update project members"
ON public.projeto_membros
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND user_id <> auth.uid()
  AND (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin'::public.app_role, 'gerente'::public.app_role)
    )
    OR EXISTS (
      SELECT 1
      FROM public.projetos p
      WHERE p.id = projeto_membros.projeto_id
        AND p.criador_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.projeto_membros pm2
      WHERE pm2.projeto_id = projeto_membros.projeto_id
        AND pm2.user_id = auth.uid()
        AND pm2.papel IN ('coordenador', 'gestor_produto', 'gerente')
        AND pm2.id <> projeto_membros.id
    )
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id <> auth.uid()
  AND papel IN (
    'coordenador',
    'gestor_produto',
    'regulatorio',
    'design',
    'controle_arte',
    'admin_cofre',
    'diretoria',
    'gerente',
    'membro'
  )
  AND (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin'::public.app_role, 'gerente'::public.app_role)
    )
    OR EXISTS (
      SELECT 1
      FROM public.projetos p
      WHERE p.id = projeto_membros.projeto_id
        AND p.criador_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.projeto_membros pm2
      WHERE pm2.projeto_id = projeto_membros.projeto_id
        AND pm2.user_id = auth.uid()
        AND pm2.papel IN ('coordenador', 'gestor_produto', 'gerente')
        AND pm2.id <> projeto_membros.id
    )
  )
);