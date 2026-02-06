
-- RPC to get unmatched cities grouped by UF
CREATE OR REPLACE FUNCTION fn_get_cidades_sem_match()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'uf', sub.uf,
    'cidade', sub.cidade,
    'quantidade', sub.qtd
  )), '[]'::jsonb) INTO result
  FROM (
    SELECT UPPER(TRIM(uf)) AS uf, UPPER(TRIM(cidade)) AS cidade, COUNT(*) AS qtd
    FROM clientes
    WHERE cnpj IS NOT NULL AND LENGTH(TRIM(cnpj)) = 14
      AND cidade IS NOT NULL AND TRIM(cidade) <> ''
      AND uf IS NOT NULL AND TRIM(uf) <> ''
      AND ibge_municipio_id IS NULL
    GROUP BY UPPER(TRIM(uf)), UPPER(TRIM(cidade))
    ORDER BY COUNT(*) DESC
    LIMIT 200
  ) sub;

  RETURN result;
END;
$$;
