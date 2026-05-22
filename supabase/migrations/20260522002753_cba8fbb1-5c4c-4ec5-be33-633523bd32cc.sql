-- 1. Trava bucket briefing-cofre no padrão (20 MB + allowlist MIME)
UPDATE storage.buckets
SET file_size_limit = 20971520,
    allowed_mime_types = ARRAY[
      'application/pdf','image/png','image/jpeg','image/webp','image/gif','image/heic',
      'video/mp4','video/quicktime','video/webm',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
      'text/plain','text/csv','application/zip'
    ]
WHERE id = 'briefing-cofre';

-- 2. DELETE de briefing_documentos alinhado com gestão do briefing
DROP POLICY IF EXISTS "doc: deleta criador ou admin" ON public.briefing_documentos;
CREATE POLICY "doc: deleta autor ou gestor"
ON public.briefing_documentos FOR DELETE TO authenticated
USING (
  created_by = auth.uid()
  OR public.can_manage_briefing(briefing_id, auth.uid())
);

-- 3. DELETE no storage do briefing-cofre alinhado
DROP POLICY IF EXISTS "briefing-cofre: deleta dono ou admin" ON storage.objects;
CREATE POLICY "briefing-cofre: deleta autor ou gestor"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'briefing-cofre'
  AND ((storage.foldername(name))[1])::uuid IN (
    SELECT b.id FROM public.briefings b
    WHERE b.user_id = auth.uid()
       OR public.has_role(auth.uid(), 'admin'::app_role)
       OR EXISTS (
            SELECT 1 FROM public.briefing_membros bm
            WHERE bm.briefing_id = b.id AND bm.user_id = auth.uid()
              AND bm.papel IN ('gestor_produto','coordenador')
          )
  )
);

-- 4. DELETE do cofre de projeto para membros do projeto
DROP POLICY IF EXISTS "cofre_doc_delete_members" ON public.projeto_cofre_documentos;
CREATE POLICY "cofre_doc_delete_members"
ON public.projeto_cofre_documentos FOR DELETE TO authenticated
USING (
  created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.projeto_membros pm
    WHERE pm.projeto_id = projeto_cofre_documentos.projeto_id
      AND pm.user_id = auth.uid()
  )
);