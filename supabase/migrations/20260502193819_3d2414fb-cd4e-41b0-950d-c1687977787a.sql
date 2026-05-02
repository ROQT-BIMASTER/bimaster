-- Finding: china_produto_submissoes_open_select + china_produto_documentos_open_select
-- Antes: china_sub_select / china_doc_select com USING(true) — leitura aberta a qualquer authenticated
-- Depois: leitura restrita ao criador, admin/supervisor, ou usuário com acesso ao módulo fábrica
-- Rollback: CREATE POLICY china_sub_select ON public.china_produto_submissoes FOR SELECT USING (true);
--           CREATE POLICY china_doc_select ON public.china_produto_documentos FOR SELECT USING (true);

BEGIN;

-- 1) china_produto_submissoes
DROP POLICY IF EXISTS china_sub_select ON public.china_produto_submissoes;
DROP POLICY IF EXISTS china_produto_submissoes_select_restricted ON public.china_produto_submissoes;

CREATE POLICY china_sub_select
ON public.china_produto_submissoes
FOR SELECT
TO authenticated
USING (
  created_by = (select auth.uid())
  OR has_role((select auth.uid()), 'admin'::app_role)
  OR has_role((select auth.uid()), 'supervisor'::app_role)
  OR check_user_access((select auth.uid()), 'fabrica'::text)
);

-- 2) china_produto_documentos
DROP POLICY IF EXISTS china_doc_select ON public.china_produto_documentos;

CREATE POLICY china_doc_select
ON public.china_produto_documentos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.china_produto_submissoes s
    WHERE s.id = china_produto_documentos.submissao_id
      AND (
        s.created_by = (select auth.uid())
        OR is_admin_or_supervisor((select auth.uid()))
        OR check_user_access((select auth.uid()), 'fabrica'::text)
      )
  )
);

COMMIT;