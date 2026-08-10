DROP FUNCTION IF EXISTS public.fn_get_municipios_kpis(text, text, integer, text, text);

CREATE OR REPLACE FUNCTION public.fn_get_share_supervisor(
  p_uf text DEFAULT NULL,
  p_regiao text DEFAULT NULL,
  p_microrregiao_id integer DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS TABLE (
  supervisor text,
  total_clientes bigint,
  total_municipios bigint,
  total_vendedores bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    CASE
      WHEN c.cod_vend = 1000 THEN 'E-commerce (carteira automática)'
      WHEN NULLIF(TRIM(COALESCE(c.supervisor, '')), '') IS NULL THEN 'Sem supervisor'
      ELSE TRIM(c.supervisor)
    END AS supervisor,
    COUNT(*)::bigint AS total_clientes,
    COUNT(DISTINCT c.ibge_municipio_id)::bigint AS total_municipios,
    COUNT(DISTINCT c.cod_vend)::bigint AS total_vendedores
  FROM public.clientes c
  JOIN public.ibge_municipios im ON im.id = c.ibge_municipio_id
  WHERE c.ibge_municipio_id IS NOT NULL
    AND LENGTH(TRIM(COALESCE(c.cnpj, ''))) = 14
    AND (p_uf IS NULL OR im.uf_sigla = p_uf)
    AND (p_regiao IS NULL OR im.regiao_nome = p_regiao)
    AND (p_microrregiao_id IS NULL OR im.microrregiao_id = p_microrregiao_id)
    AND (p_search IS NULL OR im.nome ILIKE '%' || p_search || '%')
    AND (p_status IS NULL OR p_status NOT IN ('sem_clientes', 'virgem'))
  GROUP BY 1
  ORDER BY 2 DESC;
$function$;

REVOKE ALL ON FUNCTION public.fn_get_share_supervisor(text, text, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_get_share_supervisor(text, text, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_share_supervisor(text, text, integer, text, text) TO service_role;