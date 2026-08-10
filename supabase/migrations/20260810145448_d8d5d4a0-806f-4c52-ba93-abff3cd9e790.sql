CREATE OR REPLACE FUNCTION public.fn_get_municipios_oportunidades(
  p_uf text DEFAULT NULL,
  p_regiao text DEFAULT NULL,
  p_microrregiao_id integer DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  municipio_id integer,
  municipio_nome text,
  uf_sigla text,
  regiao_nome text,
  microrregiao_id integer,
  microrregiao_nome text,
  populacao bigint,
  pib_mil_reais numeric,
  pib_per_capita numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT
    im.id,
    im.nome,
    im.uf_sigla,
    im.regiao_nome,
    im.microrregiao_id,
    im.microrregiao_nome,
    COALESCE(im.populacao_estimada, 0)::bigint,
    COALESCE(im.pib_mil_reais, 0),
    COALESCE(im.pib_per_capita, 0)
  FROM public.ibge_municipios im
  WHERE (p_uf IS NULL OR im.uf_sigla = p_uf)
    AND (p_regiao IS NULL OR im.regiao_nome = p_regiao)
    AND (p_microrregiao_id IS NULL OR im.microrregiao_id = p_microrregiao_id)
    AND (p_search IS NULL OR im.nome ILIKE '%' || p_search || '%')
    AND COALESCE(im.pib_mil_reais, 0) > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.ibge_municipio_id = im.id
        AND LENGTH(TRIM(COALESCE(c.cnpj, ''))) = 14
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.municipios m2
      JOIN public.prospects p2 ON p2.municipio_id = m2.id
      WHERE m2.uf = im.uf_sigla
        AND LOWER(TRIM(public.unaccent(m2.nome))) = LOWER(TRIM(public.unaccent(im.nome)))
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.leads_minerados lm
      WHERE lm.uf = im.uf_sigla
        AND lm.status <> 'descartado'
        AND LOWER(TRIM(public.unaccent(lm.cidade))) = LOWER(TRIM(public.unaccent(im.nome)))
    )
  ORDER BY COALESCE(im.pib_mil_reais, 0) DESC, im.nome
  LIMIT COALESCE(p_limit, 10);
$function$;

REVOKE ALL ON FUNCTION public.fn_get_municipios_oportunidades(text, text, integer, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_get_municipios_oportunidades(text, text, integer, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_municipios_oportunidades(text, text, integer, text, integer) TO service_role;