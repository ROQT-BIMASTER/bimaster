-- Migration 4: Itens D + E

-- D — estoque_etiquetas
DROP POLICY IF EXISTS estoque_etiquetas_select_all ON public.estoque_etiquetas;
DROP POLICY IF EXISTS estoque_etiquetas_insert_any ON public.estoque_etiquetas;
DROP POLICY IF EXISTS estoque_etiquetas_update_any ON public.estoque_etiquetas;
DROP POLICY IF EXISTS estoque_etiquetas_delete_any ON public.estoque_etiquetas;

CREATE POLICY estoque_etiquetas_select ON public.estoque_etiquetas
FOR SELECT TO authenticated
USING (
  public.check_user_access(auth.uid(), 'estoque')
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY estoque_etiquetas_insert ON public.estoque_etiquetas
FOR INSERT TO authenticated
WITH CHECK (
  public.check_user_access(auth.uid(), 'estoque')
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY estoque_etiquetas_update ON public.estoque_etiquetas
FOR UPDATE TO authenticated
USING (
  public.check_user_access(auth.uid(), 'estoque')
  OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  public.check_user_access(auth.uid(), 'estoque')
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY estoque_etiquetas_delete ON public.estoque_etiquetas
FOR DELETE TO authenticated
USING (
  public.check_user_access(auth.uid(), 'estoque')
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- D — estoque_etiqueta_produtos
DROP POLICY IF EXISTS estoque_etq_prod_select_all ON public.estoque_etiqueta_produtos;
DROP POLICY IF EXISTS estoque_etq_prod_insert_any ON public.estoque_etiqueta_produtos;
DROP POLICY IF EXISTS estoque_etq_prod_delete_any ON public.estoque_etiqueta_produtos;

CREATE POLICY estoque_etq_prod_select ON public.estoque_etiqueta_produtos
FOR SELECT TO authenticated
USING (
  public.check_user_access(auth.uid(), 'estoque')
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY estoque_etq_prod_insert ON public.estoque_etiqueta_produtos
FOR INSERT TO authenticated
WITH CHECK (
  public.check_user_access(auth.uid(), 'estoque')
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY estoque_etq_prod_update ON public.estoque_etiqueta_produtos
FOR UPDATE TO authenticated
USING (
  public.check_user_access(auth.uid(), 'estoque')
  OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  public.check_user_access(auth.uid(), 'estoque')
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY estoque_etq_prod_delete ON public.estoque_etiqueta_produtos
FOR DELETE TO authenticated
USING (
  public.check_user_access(auth.uid(), 'estoque')
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- E — b2c_update_membro_ou_china com WITH CHECK
DROP POLICY IF EXISTS b2c_update_membro_ou_china ON public.china_checklist_brasil_china;

CREATE POLICY b2c_update_membro_ou_china ON public.china_checklist_brasil_china
FOR UPDATE TO authenticated
USING (
  public.check_user_access(auth.uid(), 'fabrica_china')
  OR EXISTS (
    SELECT 1
    FROM public.china_submissao_projetos sp
    JOIN public.projeto_membros pm ON pm.projeto_id = sp.projeto_id
    WHERE sp.submissao_id = china_checklist_brasil_china.submissao_id
      AND pm.user_id = auth.uid()
  )
)
WITH CHECK (
  public.check_user_access(auth.uid(), 'fabrica_china')
  OR EXISTS (
    SELECT 1
    FROM public.china_submissao_projetos sp
    JOIN public.projeto_membros pm ON pm.projeto_id = sp.projeto_id
    WHERE sp.submissao_id = china_checklist_brasil_china.submissao_id
      AND pm.user_id = auth.uid()
  )
);