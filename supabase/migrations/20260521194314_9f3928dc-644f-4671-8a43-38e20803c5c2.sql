
-- ============ briefing_documentos (tabela) ============
DROP POLICY IF EXISTS "doc: ve via briefing" ON public.briefing_documentos;
DROP POLICY IF EXISTS "doc: atualiza via briefing" ON public.briefing_documentos;
DROP POLICY IF EXISTS "doc: insere via briefing" ON public.briefing_documentos;

CREATE POLICY "doc: ve via briefing"
ON public.briefing_documentos
FOR SELECT
USING (
  briefing_id IN (
    SELECT b.id FROM public.briefings b
    WHERE b.user_id = auth.uid()
       OR has_role(auth.uid(), 'admin'::app_role)
       OR (b.projeto_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.projeto_membros pm
            WHERE pm.projeto_id = b.projeto_id AND pm.user_id = auth.uid()
          ))
       OR EXISTS (
            SELECT 1 FROM public.briefing_membros bm
            WHERE bm.briefing_id = b.id AND bm.user_id = auth.uid()
          )
  )
);

CREATE POLICY "doc: atualiza via briefing"
ON public.briefing_documentos
FOR UPDATE
USING (
  briefing_id IN (
    SELECT b.id FROM public.briefings b
    WHERE b.user_id = auth.uid()
       OR has_role(auth.uid(), 'admin'::app_role)
       OR (b.projeto_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.projeto_membros pm
            WHERE pm.projeto_id = b.projeto_id AND pm.user_id = auth.uid()
          ))
       OR EXISTS (
            SELECT 1 FROM public.briefing_membros bm
            WHERE bm.briefing_id = b.id AND bm.user_id = auth.uid()
          )
  )
);

CREATE POLICY "doc: insere via briefing"
ON public.briefing_documentos
FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND briefing_id IN (
    SELECT b.id FROM public.briefings b
    WHERE b.user_id = auth.uid()
       OR has_role(auth.uid(), 'admin'::app_role)
       OR (b.projeto_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.projeto_membros pm
            WHERE pm.projeto_id = b.projeto_id AND pm.user_id = auth.uid()
          ))
       OR EXISTS (
            SELECT 1 FROM public.briefing_membros bm
            WHERE bm.briefing_id = b.id AND bm.user_id = auth.uid()
          )
  )
);

-- ============ storage.objects (bucket briefing-cofre) ============
DROP POLICY IF EXISTS "briefing-cofre: ve via briefing" ON storage.objects;
DROP POLICY IF EXISTS "briefing-cofre: insere via briefing" ON storage.objects;
DROP POLICY IF EXISTS "briefing-cofre: atualiza via briefing" ON storage.objects;

CREATE POLICY "briefing-cofre: ve via briefing"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'briefing-cofre'
  AND ((storage.foldername(name))[1])::uuid IN (
    SELECT b.id FROM public.briefings b
    WHERE b.user_id = auth.uid()
       OR has_role(auth.uid(), 'admin'::app_role)
       OR (b.projeto_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.projeto_membros pm
            WHERE pm.projeto_id = b.projeto_id AND pm.user_id = auth.uid()
          ))
       OR EXISTS (
            SELECT 1 FROM public.briefing_membros bm
            WHERE bm.briefing_id = b.id AND bm.user_id = auth.uid()
          )
  )
);

CREATE POLICY "briefing-cofre: insere via briefing"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'briefing-cofre'
  AND ((storage.foldername(name))[1])::uuid IN (
    SELECT b.id FROM public.briefings b
    WHERE b.user_id = auth.uid()
       OR has_role(auth.uid(), 'admin'::app_role)
       OR (b.projeto_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.projeto_membros pm
            WHERE pm.projeto_id = b.projeto_id AND pm.user_id = auth.uid()
          ))
       OR EXISTS (
            SELECT 1 FROM public.briefing_membros bm
            WHERE bm.briefing_id = b.id AND bm.user_id = auth.uid()
          )
  )
);

CREATE POLICY "briefing-cofre: atualiza via briefing"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'briefing-cofre'
  AND ((storage.foldername(name))[1])::uuid IN (
    SELECT b.id FROM public.briefings b
    WHERE b.user_id = auth.uid()
       OR has_role(auth.uid(), 'admin'::app_role)
       OR (b.projeto_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.projeto_membros pm
            WHERE pm.projeto_id = b.projeto_id AND pm.user_id = auth.uid()
          ))
       OR EXISTS (
            SELECT 1 FROM public.briefing_membros bm
            WHERE bm.briefing_id = b.id AND bm.user_id = auth.uid()
          )
  )
);
