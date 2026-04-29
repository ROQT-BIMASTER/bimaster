
-- 1) Storage: china-documentos
-- Trocar a policy de INSERT para aceitar tanto paths antigos (uid/...) como path com submissao_id, exigindo que o usuario seja dono da submissao OU admin/supervisor OU tenha acesso ao modulo fabrica.

DROP POLICY IF EXISTS "china_storage_insert_owned" ON storage.objects;
DROP POLICY IF EXISTS "china_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "china_storage_delete" ON storage.objects;

-- INSERT
CREATE POLICY "china_storage_insert_owned"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'china-documentos'
  AND (
    -- Path no formato {uid}/...
    (storage.foldername(name))[1] = auth.uid()::text
    -- OU path no formato {submissao_id}/... onde o user é dono ou admin/supervisor/fabrica
    OR EXISTS (
      SELECT 1 FROM public.china_produto_submissoes s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND (
          s.created_by = auth.uid()
          OR public.is_admin_or_supervisor(auth.uid())
          OR public.check_user_access(auth.uid(), 'fabrica')
        )
    )
    OR public.is_admin_or_supervisor(auth.uid())
  )
);

-- SELECT
CREATE POLICY "china_storage_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'china-documentos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin_or_supervisor(auth.uid())
    OR public.check_user_access(auth.uid(), 'fabrica')
    OR EXISTS (
      SELECT 1 FROM public.china_produto_submissoes s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND s.created_by = auth.uid()
    )
  )
);

-- DELETE
CREATE POLICY "china_storage_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'china-documentos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin_or_supervisor(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.china_produto_submissoes s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND s.created_by = auth.uid()
    )
  )
);

-- 2) Tabela china_produto_documentos: relaxar dependência exclusiva de check_user_access('fabrica').
-- Permitir CRUD para dono da submissao OU admin/supervisor OU usuarios com acesso ao modulo fabrica.

DROP POLICY IF EXISTS "china_doc_insert" ON public.china_produto_documentos;
DROP POLICY IF EXISTS "china_doc_update" ON public.china_produto_documentos;
DROP POLICY IF EXISTS "china_doc_delete" ON public.china_produto_documentos;

CREATE POLICY "china_doc_insert"
ON public.china_produto_documentos
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.china_produto_submissoes s
    WHERE s.id = china_produto_documentos.submissao_id
      AND (
        s.created_by = auth.uid()
        OR public.is_admin_or_supervisor(auth.uid())
        OR public.check_user_access(auth.uid(), 'fabrica')
      )
  )
);

CREATE POLICY "china_doc_update"
ON public.china_produto_documentos
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.china_produto_submissoes s
    WHERE s.id = china_produto_documentos.submissao_id
      AND (
        s.created_by = auth.uid()
        OR public.is_admin_or_supervisor(auth.uid())
        OR public.check_user_access(auth.uid(), 'fabrica')
      )
  )
);

CREATE POLICY "china_doc_delete"
ON public.china_produto_documentos
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.china_produto_submissoes s
    WHERE s.id = china_produto_documentos.submissao_id
      AND (
        s.created_by = auth.uid()
        OR public.is_admin_or_supervisor(auth.uid())
        OR public.check_user_access(auth.uid(), 'fabrica')
      )
  )
);
