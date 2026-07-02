DROP POLICY IF EXISTS "china_documentos_insert" ON storage.objects;
DROP POLICY IF EXISTS "china_documentos_select" ON storage.objects;
DROP POLICY IF EXISTS "china_documentos_update" ON storage.objects;
DROP POLICY IF EXISTS "china_documentos_delete" ON storage.objects;

CREATE POLICY "china_documentos_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'china-documentos'
  AND (
    (
      (storage.foldername(name))[1] = auth.uid()::text
      AND (
        auth.uid() IN (
          SELECT ur.user_id
          FROM public.user_roles ur
          WHERE ur.role = 'admin'::public.app_role
        )
        OR EXISTS (
          SELECT 1
          FROM public.china_produto_submissoes s
          WHERE s.id::text = (storage.foldername(objects.name))[2]
            AND (
              s.created_by = auth.uid()
              OR EXISTS (
                SELECT 1
                FROM public.china_submissao_projetos sp
                JOIN public.projeto_membros pm ON pm.projeto_id = sp.projeto_id
                WHERE sp.submissao_id = s.id
                  AND pm.user_id = auth.uid()
              )
            )
        )
      )
    )
    OR (
      (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND (
        auth.uid() IN (
          SELECT ur.user_id
          FROM public.user_roles ur
          WHERE ur.role = 'admin'::public.app_role
        )
        OR EXISTS (
          SELECT 1
          FROM public.china_produto_submissoes s
          WHERE s.id::text = (storage.foldername(objects.name))[1]
            AND (
              s.created_by = auth.uid()
              OR EXISTS (
                SELECT 1
                FROM public.china_submissao_projetos sp
                JOIN public.projeto_membros pm ON pm.projeto_id = sp.projeto_id
                WHERE sp.submissao_id = s.id
                  AND pm.user_id = auth.uid()
              )
            )
        )
      )
    )
  )
);

CREATE POLICY "china_documentos_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'china-documentos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR auth.uid() IN (
      SELECT ur.user_id
      FROM public.user_roles ur
      WHERE ur.role = 'admin'::public.app_role
    )
    OR public.is_admin_or_supervisor(auth.uid())
    OR public.check_user_access(auth.uid(), 'fabrica'::text)
    OR public.check_user_access(auth.uid(), 'china'::text)
    OR EXISTS (
      SELECT 1
      FROM public.china_produto_submissoes s
      WHERE s.id::text IN ((storage.foldername(objects.name))[1], (storage.foldername(objects.name))[2])
        AND (
          s.created_by = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.china_submissao_projetos sp
            JOIN public.projeto_membros pm ON pm.projeto_id = sp.projeto_id
            WHERE sp.submissao_id = s.id
              AND pm.user_id = auth.uid()
          )
        )
    )
  )
);

CREATE POLICY "china_documentos_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'china-documentos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR auth.uid() IN (
      SELECT ur.user_id
      FROM public.user_roles ur
      WHERE ur.role = 'admin'::public.app_role
    )
    OR EXISTS (
      SELECT 1
      FROM public.china_produto_submissoes s
      WHERE s.id::text IN ((storage.foldername(objects.name))[1], (storage.foldername(objects.name))[2])
        AND (
          s.created_by = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.china_submissao_projetos sp
            JOIN public.projeto_membros pm ON pm.projeto_id = sp.projeto_id
            WHERE sp.submissao_id = s.id
              AND pm.user_id = auth.uid()
          )
        )
    )
  )
)
WITH CHECK (
  bucket_id = 'china-documentos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR auth.uid() IN (
      SELECT ur.user_id
      FROM public.user_roles ur
      WHERE ur.role = 'admin'::public.app_role
    )
    OR EXISTS (
      SELECT 1
      FROM public.china_produto_submissoes s
      WHERE s.id::text IN ((storage.foldername(objects.name))[1], (storage.foldername(objects.name))[2])
        AND (
          s.created_by = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.china_submissao_projetos sp
            JOIN public.projeto_membros pm ON pm.projeto_id = sp.projeto_id
            WHERE sp.submissao_id = s.id
              AND pm.user_id = auth.uid()
          )
        )
    )
  )
);

CREATE POLICY "china_documentos_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'china-documentos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR auth.uid() IN (
      SELECT ur.user_id
      FROM public.user_roles ur
      WHERE ur.role = 'admin'::public.app_role
    )
    OR EXISTS (
      SELECT 1
      FROM public.china_produto_submissoes s
      WHERE s.id::text IN ((storage.foldername(objects.name))[1], (storage.foldername(objects.name))[2])
        AND (
          s.created_by = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.china_submissao_projetos sp
            JOIN public.projeto_membros pm ON pm.projeto_id = sp.projeto_id
            WHERE sp.submissao_id = s.id
              AND pm.user_id = auth.uid()
          )
        )
    )
  )
);