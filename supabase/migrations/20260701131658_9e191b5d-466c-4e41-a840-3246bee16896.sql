CREATE OR REPLACE FUNCTION public.user_can_access_china_submissao(_submissao_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'supervisor'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.china_produto_submissoes s
      WHERE s.id = _submissao_id AND s.created_by = _user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.usuario_permissoes_modulos upm
      JOIN public.modulos_sistema m ON m.id = upm.modulo_id
      WHERE upm.usuario_id = _user_id
        AND m.codigo IN ('fabrica','china')
    )
    OR EXISTS (
      SELECT 1
      FROM public.china_submissao_projetos csp
      JOIN public.projeto_membros pm ON pm.projeto_id = csp.projeto_id
      WHERE csp.submissao_id = _submissao_id
        AND pm.user_id = _user_id
    )
$$;

REVOKE ALL ON FUNCTION public.user_can_access_china_submissao(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_access_china_submissao(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS china_sub_select ON public.china_produto_submissoes;
DROP POLICY IF EXISTS china_sub_update ON public.china_produto_submissoes;

CREATE POLICY china_sub_select
ON public.china_produto_submissoes
FOR SELECT
TO authenticated
USING (public.user_can_access_china_submissao(id, auth.uid()));

CREATE POLICY china_sub_update
ON public.china_produto_submissoes
FOR UPDATE
TO authenticated
USING (public.user_can_access_china_submissao(id, auth.uid()))
WITH CHECK (public.user_can_access_china_submissao(id, auth.uid()));