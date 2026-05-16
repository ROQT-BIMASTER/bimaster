-- Permite que usuários do módulo China (não só Fábrica) leiam/modifiquem
-- a lista de itens ocultos do checklist. Sem isso, usuários China veem o
-- checklist DIVERGENTE do admin (itens removidos pelo admin reaparecem).
DROP POLICY IF EXISTS ccio_select ON public.china_checklist_itens_ocultos;
DROP POLICY IF EXISTS ccio_modify ON public.china_checklist_itens_ocultos;

CREATE POLICY ccio_select
  ON public.china_checklist_itens_ocultos
  FOR SELECT
  TO authenticated
  USING (
    check_user_access((SELECT auth.uid()), 'fabrica')
    OR check_user_access((SELECT auth.uid()), 'china')
    OR has_role((SELECT auth.uid()), 'admin'::app_role)
  );

CREATE POLICY ccio_modify
  ON public.china_checklist_itens_ocultos
  FOR ALL
  TO authenticated
  USING (
    check_user_access((SELECT auth.uid()), 'fabrica')
    OR check_user_access((SELECT auth.uid()), 'china')
    OR has_role((SELECT auth.uid()), 'admin'::app_role)
  )
  WITH CHECK (
    check_user_access((SELECT auth.uid()), 'fabrica')
    OR check_user_access((SELECT auth.uid()), 'china')
    OR has_role((SELECT auth.uid()), 'admin'::app_role)
  );