-- Migration 3: re-escopar policies do bucket china-documentos.
-- SELECT: dono / submissão / membros do projeto vinculado / módulos / admin.
-- INSERT/DELETE: dono do path (obrigatório) + (dono da submissão OU membro do projeto vinculado OU admin).
-- UPDATE: dono do path OU admin (com WITH CHECK).

DROP POLICY IF EXISTS china_storage_select ON storage.objects;
DROP POLICY IF EXISTS china_storage_insert_owned ON storage.objects;
DROP POLICY IF EXISTS china_storage_delete ON storage.objects;
DROP POLICY IF EXISTS china_documentos_select ON storage.objects;
DROP POLICY IF EXISTS china_documentos_insert ON storage.objects;
DROP POLICY IF EXISTS china_documentos_update ON storage.objects;
DROP POLICY IF EXISTS china_documentos_delete ON storage.objects;

-- SELECT amplo (mantém acesso por módulo)
CREATE POLICY china_documentos_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'china-documentos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin_or_supervisor(auth.uid())
    OR public.check_user_access(auth.uid(), 'fabrica')
    OR public.check_user_access(auth.uid(), 'china')
    OR public.check_user_access(auth.uid(), 'projetos')
    OR EXISTS (
      SELECT 1 FROM public.china_produto_submissoes s
      WHERE s.id::text = (storage.foldername(objects.name))[2]
        AND (
          s.created_by = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.china_submissao_projetos sp
            JOIN public.projeto_membros pm ON pm.projeto_id = sp.projeto_id
            WHERE sp.submissao_id = s.id AND pm.user_id = auth.uid()
          )
        )
    )
  )
);

-- INSERT restrito: dono do path obrigatório + escopo
CREATE POLICY china_documentos_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'china-documentos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.china_produto_submissoes s
      WHERE s.id::text = (storage.foldername(objects.name))[2]
        AND (
          s.created_by = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.china_submissao_projetos sp
            JOIN public.projeto_membros pm ON pm.projeto_id = sp.projeto_id
            WHERE sp.submissao_id = s.id AND pm.user_id = auth.uid()
          )
        )
    )
  )
);

-- UPDATE: dono ou admin, com WITH CHECK
CREATE POLICY china_documentos_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'china-documentos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
)
WITH CHECK (
  bucket_id = 'china-documentos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- DELETE: dono do path OU dono da submissão OU membro do projeto vinculado OU admin
CREATE POLICY china_documentos_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'china-documentos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.china_produto_submissoes s
      WHERE s.id::text = (storage.foldername(objects.name))[2]
        AND (
          s.created_by = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.china_submissao_projetos sp
            JOIN public.projeto_membros pm ON pm.projeto_id = sp.projeto_id
            WHERE sp.submissao_id = s.id AND pm.user_id = auth.uid()
          )
        )
    )
  )
);