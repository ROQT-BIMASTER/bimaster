CREATE OR REPLACE FUNCTION public.estoque_filtro_opcoes()
RETURNS TABLE (
  empresas jsonb,
  linhas text[],
  unidades text[]
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_admin boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  v_admin := public.has_role(v_user, 'admin') OR public.has_role(v_user, 'gerente');

  RETURN QUERY
  WITH base AS (
    SELECT DISTINCT e.empresa_par, e.abrev_par, e.nome_linha, e.unidade_medida
    FROM public.erp_estoque_distribuidora e
    WHERE v_admin
       OR e.empresa_par IN (
         SELECT ue.empresa_id FROM public.user_empresas ue WHERE ue.user_id = v_user
       )
  )
  SELECT
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', empresa_par, 'nome', COALESCE(abrev_par, 'Empresa ' || empresa_par)) ORDER BY COALESCE(abrev_par, ''))
      FROM (SELECT DISTINCT empresa_par, abrev_par FROM base WHERE empresa_par IS NOT NULL) x
    ), '[]'::jsonb),
    COALESCE((SELECT array_agg(DISTINCT nome_linha ORDER BY nome_linha) FROM base WHERE nome_linha IS NOT NULL), ARRAY[]::text[]),
    COALESCE((SELECT array_agg(DISTINCT unidade_medida ORDER BY unidade_medida) FROM base WHERE unidade_medida IS NOT NULL), ARRAY[]::text[]);
END;
$$;

GRANT EXECUTE ON FUNCTION public.estoque_filtro_opcoes() TO authenticated;