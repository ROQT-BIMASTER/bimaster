CREATE OR REPLACE FUNCTION public.vendas_uf_yoy(p_ano integer DEFAULT NULL::integer, p_empresa integer DEFAULT NULL::integer, p_tabela_preco integer DEFAULT NULL::integer, p_cliente integer DEFAULT NULL::integer, p_vendedor integer DEFAULT NULL::integer)
 RETURNS TABLE(uf text, fat_atual numeric, fat_anterior numeric, notas_atual bigint)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ano int;
  v_mmax int;
BEGIN
  v_ano := COALESCE(p_ano, EXTRACT(YEAR FROM CURRENT_DATE)::int);
  v_mmax := CASE WHEN v_ano = EXTRACT(YEAR FROM CURRENT_DATE)::int
                 THEN GREATEST(EXTRACT(MONTH FROM CURRENT_DATE)::int - 1, 1)
                 ELSE 12 END;

  RETURN QUERY
  SELECT COALESCE(NULLIF(v.cliente_uf, ''), c.uf, '—') AS uf,
    COALESCE(SUM(v.total_nota) FILTER (WHERE EXTRACT(YEAR FROM v.data_emissao)=v_ano   AND EXTRACT(MONTH FROM v.data_emissao)<=v_mmax),0)::numeric AS fat_atual,
    COALESCE(SUM(v.total_nota) FILTER (WHERE EXTRACT(YEAR FROM v.data_emissao)=v_ano-1 AND EXTRACT(MONTH FROM v.data_emissao)<=v_mmax),0)::numeric AS fat_anterior,
    COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM v.data_emissao)=v_ano AND EXTRACT(MONTH FROM v.data_emissao)<=v_mmax)::bigint AS notas_atual
  FROM public.v_vendas v
  LEFT JOIN public.clientes c ON c.codigo = v.cliente_futura_id
  WHERE EXTRACT(YEAR FROM v.data_emissao) IN (v_ano, v_ano-1)
    AND EXTRACT(MONTH FROM v.data_emissao) <= v_mmax
    AND (p_empresa IS NULL OR v.empresa_id = p_empresa)
    AND (p_tabela_preco IS NULL OR v.tabela_preco_id = p_tabela_preco)
    AND (p_cliente IS NULL OR v.cliente_futura_id = p_cliente)
    AND (p_vendedor IS NULL OR v.vendedor_futura_id = p_vendedor)
  GROUP BY COALESCE(NULLIF(v.cliente_uf, ''), c.uf, '—')
  HAVING COALESCE(SUM(v.total_nota) FILTER (WHERE EXTRACT(YEAR FROM v.data_emissao)=v_ano AND EXTRACT(MONTH FROM v.data_emissao)<=v_mmax),0) > 0
  ORDER BY fat_atual DESC;
END;
$function$;