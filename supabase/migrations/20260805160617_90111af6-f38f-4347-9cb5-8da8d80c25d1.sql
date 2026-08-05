ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS imagem_url text;

CREATE POLICY "projeto_capas_select_membros"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'projeto-capas'
  AND public.user_is_projeto_member(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
);

CREATE POLICY "projeto_capas_insert_editores"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'projeto-capas'
  AND (
    EXISTS (
      SELECT 1 FROM public.projetos p
      WHERE p.id = NULLIF((storage.foldername(name))[1], '')::uuid
        AND p.criador_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.projeto_membros pm
      WHERE pm.projeto_id = NULLIF((storage.foldername(name))[1], '')::uuid
        AND pm.user_id = auth.uid()
        AND pm.papel IN ('gerente', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::public.app_role
    )
  )
);

CREATE POLICY "projeto_capas_update_editores"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'projeto-capas'
  AND (
    EXISTS (
      SELECT 1 FROM public.projetos p
      WHERE p.id = NULLIF((storage.foldername(name))[1], '')::uuid
        AND p.criador_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.projeto_membros pm
      WHERE pm.projeto_id = NULLIF((storage.foldername(name))[1], '')::uuid
        AND pm.user_id = auth.uid()
        AND pm.papel IN ('gerente', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::public.app_role
    )
  )
);

CREATE POLICY "projeto_capas_delete_editores"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'projeto-capas'
  AND (
    EXISTS (
      SELECT 1 FROM public.projetos p
      WHERE p.id = NULLIF((storage.foldername(name))[1], '')::uuid
        AND p.criador_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.projeto_membros pm
      WHERE pm.projeto_id = NULLIF((storage.foldername(name))[1], '')::uuid
        AND pm.user_id = auth.uid()
        AND pm.papel IN ('gerente', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::public.app_role
    )
  )
);