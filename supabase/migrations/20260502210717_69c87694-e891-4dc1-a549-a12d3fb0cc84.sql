-- Ampliar leitura de submissões e documentos China para módulos 'china' e 'projetos'
-- (escrita continua restrita: fabrica + china + admin/supervisor)

-- china_produto_submissoes : SELECT
DROP POLICY IF EXISTS china_sub_select ON public.china_produto_submissoes;
CREATE POLICY china_sub_select ON public.china_produto_submissoes
FOR SELECT TO authenticated
USING (
  created_by = (SELECT auth.uid())
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  OR public.has_role((SELECT auth.uid()), 'supervisor'::public.app_role)
  OR public.check_user_access((SELECT auth.uid()), 'fabrica')
  OR public.check_user_access((SELECT auth.uid()), 'china')
  OR public.check_user_access((SELECT auth.uid()), 'projetos')
);

-- china_produto_submissoes : UPDATE (inclui módulo 'china', sem 'projetos')
DROP POLICY IF EXISTS china_sub_update ON public.china_produto_submissoes;
CREATE POLICY china_sub_update ON public.china_produto_submissoes
FOR UPDATE TO authenticated
USING (
  (auth.uid() = created_by)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
  OR public.check_user_access(auth.uid(), 'fabrica')
  OR public.check_user_access(auth.uid(), 'china')
);

-- china_produto_documentos : SELECT
DROP POLICY IF EXISTS china_doc_select ON public.china_produto_documentos;
CREATE POLICY china_doc_select ON public.china_produto_documentos
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.china_produto_submissoes s
    WHERE s.id = china_produto_documentos.submissao_id
      AND (
        s.created_by = (SELECT auth.uid())
        OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
        OR public.has_role((SELECT auth.uid()), 'supervisor'::public.app_role)
        OR public.check_user_access((SELECT auth.uid()), 'fabrica')
        OR public.check_user_access((SELECT auth.uid()), 'china')
        OR public.check_user_access((SELECT auth.uid()), 'projetos')
      )
  )
);

-- china_produto_documentos : UPDATE
DROP POLICY IF EXISTS china_doc_update ON public.china_produto_documentos;
CREATE POLICY china_doc_update ON public.china_produto_documentos
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.china_produto_submissoes s
    WHERE s.id = china_produto_documentos.submissao_id
      AND (
        s.created_by = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
        OR public.check_user_access(auth.uid(), 'fabrica')
        OR public.check_user_access(auth.uid(), 'china')
      )
  )
);

-- china_produto_documentos : DELETE
DROP POLICY IF EXISTS china_doc_delete ON public.china_produto_documentos;
CREATE POLICY china_doc_delete ON public.china_produto_documentos
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.china_produto_submissoes s
    WHERE s.id = china_produto_documentos.submissao_id
      AND (
        s.created_by = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
        OR public.check_user_access(auth.uid(), 'fabrica')
        OR public.check_user_access(auth.uid(), 'china')
      )
  )
);