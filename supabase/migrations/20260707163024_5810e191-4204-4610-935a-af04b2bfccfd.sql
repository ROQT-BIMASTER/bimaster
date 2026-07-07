
-- vendas_uf_yoy: adiciona p_mes ao final
CREATE OR REPLACE FUNCTION public.vendas_uf_yoy(
  p_ano integer DEFAULT NULL,
  p_empresa integer DEFAULT NULL,
  p_tabela_preco integer DEFAULT NULL,
  p_cliente integer DEFAULT NULL,
  p_vendedor integer DEFAULT NULL,
  p_mes integer DEFAULT NULL
)
RETURNS TABLE(uf text, fat_atual numeric, fat_anterior numeric, notas_atual bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ano int;
  v_mmax int;
  v_mmin int;
BEGIN
  v_ano := COALESCE(p_ano, EXTRACT(YEAR FROM CURRENT_DATE)::int);

  IF p_mes IS NOT NULL THEN
    v_mmin := p_mes;
    v_mmax := p_mes;
  ELSE
    v_mmin := 1;
    v_mmax := CASE WHEN v_ano = EXTRACT(YEAR FROM CURRENT_DATE)::int
                   THEN GREATEST(EXTRACT(MONTH FROM CURRENT_DATE)::int - 1, 1)
                   ELSE 12 END;
  END IF;

  RETURN QUERY
  SELECT COALESCE(NULLIF(v.cliente_uf, ''), c.uf, '—') AS uf,
    COALESCE(SUM(v.total_nota) FILTER (WHERE EXTRACT(YEAR FROM v.data_emissao)=v_ano   AND EXTRACT(MONTH FROM v.data_emissao) BETWEEN v_mmin AND v_mmax),0)::numeric AS fat_atual,
    COALESCE(SUM(v.total_nota) FILTER (WHERE EXTRACT(YEAR FROM v.data_emissao)=v_ano-1 AND EXTRACT(MONTH FROM v.data_emissao) BETWEEN v_mmin AND v_mmax),0)::numeric AS fat_anterior,
    COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM v.data_emissao)=v_ano AND EXTRACT(MONTH FROM v.data_emissao) BETWEEN v_mmin AND v_mmax)::bigint AS notas_atual
  FROM public.v_vendas v
  LEFT JOIN public.clientes c ON c.codigo::text = v.cliente_futura_id::text
  WHERE EXTRACT(YEAR FROM v.data_emissao) IN (v_ano, v_ano-1)
    AND EXTRACT(MONTH FROM v.data_emissao) BETWEEN v_mmin AND v_mmax
    AND (p_empresa IS NULL OR v.empresa_id = p_empresa)
    AND (p_tabela_preco IS NULL OR v.tabela_preco_id = p_tabela_preco)
    AND (p_cliente IS NULL OR v.cliente_futura_id = p_cliente)
    AND (p_vendedor IS NULL OR v.vendedor_futura_id = p_vendedor)
  GROUP BY COALESCE(NULLIF(v.cliente_uf, ''), c.uf, '—')
  HAVING COALESCE(SUM(v.total_nota) FILTER (WHERE EXTRACT(YEAR FROM v.data_emissao)=v_ano AND EXTRACT(MONTH FROM v.data_emissao) BETWEEN v_mmin AND v_mmax),0) > 0
  ORDER BY fat_atual DESC;
END;
$function$;

-- vendas_yoy_por_dimensao: adiciona p_mes ao final
CREATE OR REPLACE FUNCTION public.vendas_yoy_por_dimensao(
  p_dim text DEFAULT 'cliente',
  p_ano integer DEFAULT NULL,
  p_empresa integer DEFAULT NULL,
  p_tabela_preco integer DEFAULT NULL,
  p_uf text DEFAULT NULL,
  p_cliente integer DEFAULT NULL,
  p_vendedor integer DEFAULT NULL,
  p_mes integer DEFAULT NULL
)
RETURNS TABLE(chave integer, nome text, fat_atual numeric, fat_anterior numeric, variacao numeric, notas_atual bigint, novo boolean)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_ano int;
  v_mmax int;
  v_mmin int;
BEGIN
  v_ano := COALESCE(p_ano, EXTRACT(YEAR FROM CURRENT_DATE)::int);

  IF p_mes IS NOT NULL THEN
    v_mmin := p_mes;
    v_mmax := p_mes;
  ELSE
    v_mmin := 1;
    SELECT COALESCE(MAX(EXTRACT(MONTH FROM data_emissao))::int, 12)
      INTO v_mmax
    FROM public.v_vendas
    WHERE EXTRACT(YEAR FROM data_emissao) = v_ano
      AND (p_empresa IS NULL OR empresa_id = p_empresa);
  END IF;

  RETURN QUERY
  SELECT
    CASE WHEN p_dim = 'vendedor' THEN v.vendedor_futura_id
         ELSE v.cliente_futura_id END AS chave,
    MAX(CASE WHEN p_dim = 'vendedor' THEN v.vendedor_nome
             ELSE v.cliente_nome END) AS nome,
    COALESCE(SUM(v.total_nota) FILTER (
      WHERE EXTRACT(YEAR FROM v.data_emissao) = v_ano
        AND EXTRACT(MONTH FROM v.data_emissao) BETWEEN v_mmin AND v_mmax
    ), 0) AS fat_atual,
    COALESCE(SUM(v.total_nota) FILTER (
      WHERE EXTRACT(YEAR FROM v.data_emissao) = v_ano - 1
        AND EXTRACT(MONTH FROM v.data_emissao) BETWEEN v_mmin AND v_mmax
    ), 0) AS fat_anterior,
    NULL::numeric AS variacao,
    COUNT(*) FILTER (
      WHERE EXTRACT(YEAR FROM v.data_emissao) = v_ano
        AND EXTRACT(MONTH FROM v.data_emissao) BETWEEN v_mmin AND v_mmax
    ) AS notas_atual,
    false AS novo
  FROM public.v_vendas v
  WHERE (p_empresa IS NULL OR v.empresa_id = p_empresa)
    AND (p_tabela_preco IS NULL OR v.tabela_preco_id = p_tabela_preco)
    AND (p_uf IS NULL OR v.cliente_uf = p_uf)
    AND (p_cliente IS NULL OR v.cliente_futura_id = p_cliente)
    AND (p_vendedor IS NULL OR v.vendedor_futura_id = p_vendedor)
    AND EXTRACT(YEAR FROM v.data_emissao) IN (v_ano, v_ano - 1)
    AND EXTRACT(MONTH FROM v.data_emissao) BETWEEN v_mmin AND v_mmax
  GROUP BY 1
  HAVING COALESCE(SUM(v.total_nota) FILTER (
    WHERE EXTRACT(YEAR FROM v.data_emissao) = v_ano
      AND EXTRACT(MONTH FROM v.data_emissao) BETWEEN v_mmin AND v_mmax
  ), 0) > 0
  ORDER BY fat_atual DESC;
END;
$function$;
