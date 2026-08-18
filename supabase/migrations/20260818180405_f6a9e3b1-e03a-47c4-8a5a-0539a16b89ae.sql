CREATE OR REPLACE FUNCTION public.fn_get_relatorio_vendedores(
  p_uf text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_somente_ativos boolean DEFAULT false
)
RETURNS TABLE (
  cod_vend integer,
  vendedor text,
  total_clientes bigint,
  clientes_ativos bigint,
  total_municipios bigint,
  total_ufs bigint,
  total_supervisores bigint,
  supervisores text,
  equipes text,
  ultima_compra timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      c.cod_vend AS cv,
      COALESCE(NULLIF(TRIM(c.vendedor), ''), 'Sem vendedor') AS vend,
      COALESCE(c.cidade_normalizada, LOWER(c.cidade)) AS municipio,
      c.uf AS uf,
      NULLIF(TRIM(c.supervisor), '') AS sup,
      NULLIF(TRIM(c.nome_equipe), '') AS equipe,
      c.data_ultima_compra AS ultima
    FROM public.clientes c
    WHERE c.is_honeytoken = false
      AND (p_uf IS NULL OR c.uf = p_uf)
      AND (p_search IS NULL OR p_search = ''
           OR c.vendedor ILIKE '%' || p_search || '%'
           OR c.supervisor ILIKE '%' || p_search || '%')
      AND (p_somente_ativos = false OR c.status_bloqueio = 'ativo')
  )
  SELECT
    b.cv,
    b.vend,
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE b.ultima >= now() - interval '180 days')::bigint,
    COUNT(DISTINCT b.municipio)::bigint,
    COUNT(DISTINCT b.uf)::bigint,
    COUNT(DISTINCT b.sup)::bigint,
    (SELECT string_agg(x, ', ' ORDER BY x) FROM (SELECT DISTINCT b2.sup AS x FROM base b2 WHERE b2.cv IS NOT DISTINCT FROM b.cv AND b2.vend = b.vend AND b2.sup IS NOT NULL) s),
    (SELECT string_agg(y, ', ' ORDER BY y) FROM (SELECT DISTINCT b3.equipe AS y FROM base b3 WHERE b3.cv IS NOT DISTINCT FROM b.cv AND b3.vend = b.vend AND b3.equipe IS NOT NULL) e),
    MAX(b.ultima)
  FROM base b
  GROUP BY b.cv, b.vend
  ORDER BY 3 DESC
$$;

REVOKE ALL ON FUNCTION public.fn_get_relatorio_vendedores(text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_get_relatorio_vendedores(text, text, boolean) TO authenticated, service_role;