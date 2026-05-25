CREATE OR REPLACE FUNCTION public.rpc_sugerir_fornecedores_ap(
  p_nome text,
  p_limit int DEFAULT 8
)
RETURNS TABLE(
  fornecedor_codigo text,
  fornecedor_nome   text,
  empresa_nome      text,
  titulos           bigint,
  valor_12m         numeric,
  ultimo_vencimento date,
  similaridade      real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH base AS (
    SELECT
      cp.fornecedor_codigo,
      cp.fornecedor_nome,
      cp.empresa_nome,
      cp.valor_original,
      cp.data_vencimento,
      extensions.similarity(
        extensions.unaccent(upper(cp.fornecedor_nome)),
        extensions.unaccent(upper(coalesce(p_nome,'')))
      ) AS sim
    FROM public.contas_pagar cp
    WHERE cp.fornecedor_codigo IS NOT NULL
      AND cp.fornecedor_nome IS NOT NULL
      AND (
        extensions.unaccent(upper(cp.fornecedor_nome)) operator(extensions.%) extensions.unaccent(upper(coalesce(p_nome,'')))
        OR extensions.unaccent(upper(cp.fornecedor_nome)) ILIKE
           '%' || extensions.unaccent(upper(split_part(regexp_replace(coalesce(p_nome,''), '[()]', '', 'g'),' ',1))) || '%'
      )
  )
  SELECT
    b.fornecedor_codigo,
    max(b.fornecedor_nome) AS fornecedor_nome,
    max(b.empresa_nome)    AS empresa_nome,
    count(*)::bigint       AS titulos,
    sum(
      CASE WHEN b.data_vencimento >= (current_date - interval '12 months')
           THEN b.valor_original ELSE 0 END
    )::numeric             AS valor_12m,
    max(b.data_vencimento) AS ultimo_vencimento,
    max(b.sim)             AS similaridade
  FROM base b
  GROUP BY b.fornecedor_codigo
  ORDER BY max(b.sim) DESC NULLS LAST, count(*) DESC
  LIMIT greatest(1, least(coalesce(p_limit, 8), 25));
$$;

REVOKE ALL ON FUNCTION public.rpc_sugerir_fornecedores_ap(text, int) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_sugerir_fornecedores_ap(text, int) TO authenticated;