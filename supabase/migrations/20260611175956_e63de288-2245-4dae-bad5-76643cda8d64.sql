-- Alinha INSERT de china_produto_documentos com SELECT/UPDATE/DELETE:
-- usuários com acesso ao módulo "china" também podem anexar documentos
-- no checklist (antes só 'fabrica' + dono + admin/supervisor passavam).
DROP POLICY IF EXISTS china_doc_insert ON public.china_produto_documentos;

CREATE POLICY china_doc_insert
ON public.china_produto_documentos
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
      FROM public.china_produto_submissoes s
     WHERE s.id = china_produto_documentos.submissao_id
       AND (
         s.created_by = (SELECT auth.uid())
         OR public.is_admin_or_supervisor((SELECT auth.uid()))
         OR public.check_user_access((SELECT auth.uid()), 'fabrica')
         OR public.check_user_access((SELECT auth.uid()), 'china')
       )
  )
);