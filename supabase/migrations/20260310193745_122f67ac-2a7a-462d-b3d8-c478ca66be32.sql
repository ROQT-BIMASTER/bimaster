
-- 1. Drop permissive RLS policies on projeto_tarefa_documentos
DROP POLICY IF EXISTS "Authenticated users can manage projeto_tarefa_documentos" ON public.projeto_tarefa_documentos;
DROP POLICY IF EXISTS "Users can view projeto_tarefa_documentos" ON public.projeto_tarefa_documentos;
DROP POLICY IF EXISTS "Users can insert projeto_tarefa_documentos" ON public.projeto_tarefa_documentos;
DROP POLICY IF EXISTS "Users can update projeto_tarefa_documentos" ON public.projeto_tarefa_documentos;
DROP POLICY IF EXISTS "Users can delete projeto_tarefa_documentos" ON public.projeto_tarefa_documentos;

-- 2. Create scoped RLS policies using user_can_access_secao
CREATE POLICY "projeto_tarefa_docs_select"
ON public.projeto_tarefa_documentos
FOR SELECT TO authenticated
USING (
  public.user_can_access_secao(auth.uid(), (SELECT secao_id FROM public.projeto_tarefas WHERE id = tarefa_id))
);

CREATE POLICY "projeto_tarefa_docs_insert"
ON public.projeto_tarefa_documentos
FOR INSERT TO authenticated
WITH CHECK (
  public.user_can_access_secao(auth.uid(), (SELECT secao_id FROM public.projeto_tarefas WHERE id = tarefa_id))
);

CREATE POLICY "projeto_tarefa_docs_update"
ON public.projeto_tarefa_documentos
FOR UPDATE TO authenticated
USING (
  public.user_can_access_secao(auth.uid(), (SELECT secao_id FROM public.projeto_tarefas WHERE id = tarefa_id))
)
WITH CHECK (
  public.user_can_access_secao(auth.uid(), (SELECT secao_id FROM public.projeto_tarefas WHERE id = tarefa_id))
);

CREATE POLICY "projeto_tarefa_docs_delete"
ON public.projeto_tarefa_documentos
FOR DELETE TO authenticated
USING (
  public.user_can_access_secao(auth.uid(), (SELECT secao_id FROM public.projeto_tarefas WHERE id = tarefa_id))
);

-- 3. Make bucket private
UPDATE storage.buckets SET public = false WHERE id = 'projeto-documentos';

-- 4. Drop old permissive storage policies and create scoped ones
DROP POLICY IF EXISTS "Authenticated users can upload projeto docs" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view projeto docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete projeto docs" ON storage.objects;

-- Upload: only to paths under project IDs the user can access
CREATE POLICY "projeto_docs_upload"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'projeto-documentos'
  AND public.user_can_access_projeto(auth.uid(), (string_to_array(name, '/'))[1]::uuid)
);

-- Read: scoped to accessible projects
CREATE POLICY "projeto_docs_select"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'projeto-documentos'
  AND public.user_can_access_projeto(auth.uid(), (string_to_array(name, '/'))[1]::uuid)
);

-- Delete: scoped to accessible projects
CREATE POLICY "projeto_docs_delete"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'projeto-documentos'
  AND public.user_can_access_projeto(auth.uid(), (string_to_array(name, '/'))[1]::uuid)
);
