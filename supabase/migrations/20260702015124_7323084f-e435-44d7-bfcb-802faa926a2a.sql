
CREATE OR REPLACE FUNCTION public.vendas_yoy_por_dimensao(
  p_dim text DEFAULT 'cliente',
  p_ano int DEFAULT NULL,
  p_empresa int DEFAULT NULL
)
RETURNS TABLE (
  chave int,
  nome text,
  fat_atual numeric,
  fat_anterior numeric,
  variacao numeric,
  notas_atual bigint,
  novo boolean
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_ano int;
  v_mmax int;
BEGIN
  v_ano := COALESCE(p_ano, EXTRACT(YEAR FROM CURRENT_DATE)::int);

  SELECT COALESCE(MAX(EXTRACT(MONTH FROM data_emissao))::int, 12)
    INTO v_mmax
  FROM public.v_vendas
  WHERE EXTRACT(YEAR FROM data_emissao) = v_ano
    AND (p_empresa IS NULL OR empresa_id = p_empresa);

  RETURN QUERY
  SELECT
    CASE WHEN p_dim = 'vendedor' THEN v.vendedor_futura_id
         ELSE v.cliente_futura_id END AS chave,
    MAX(CASE WHEN p_dim = 'vendedor' THEN v.vendedor_nome
             ELSE v.cliente_nome END) AS nome,
    COALESCE(SUM(v.total_nota) FILTER (
      WHERE EXTRACT(YEAR FROM v.data_emissao) = v_ano
    ), 0) AS fat_atual,
    COALESCE(SUM(v.total_nota) FILTER (
      WHERE EXTRACT(YEAR FROM v.data_emissao) = v_ano - 1
        AND EXTRACT(MONTH FROM v.data_emissao) <= v_mmax
    ), 0) AS fat_anterior,
    NULL::numeric AS variacao,
    COUNT(*) FILTER (
      WHERE EXTRACT(YEAR FROM v.data_emissao) = v_ano
    ) AS notas_atual,
    false AS novo
  FROM public.v_vendas v
  WHERE (p_empresa IS NULL OR v.empresa_id = p_empresa)
    AND EXTRACT(YEAR FROM v.data_emissao) IN (v_ano, v_ano - 1)
  GROUP BY 1
  HAVING COALESCE(SUM(v.total_nota) FILTER (
    WHERE EXTRACT(YEAR FROM v.data_emissao) = v_ano
  ), 0) > 0
  ORDER BY fat_atual DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vendas_yoy_por_dimensao(text, int, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.vendas_share_tabela_preco(
  p_de date DEFAULT NULL,
  p_ate date DEFAULT NULL,
  p_empresa int DEFAULT NULL
)
RETURNS TABLE (
  tabela_preco_id int,
  tabela_preco_nome text,
  notas bigint,
  faturamento numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    v.tabela_preco_id,
    COALESCE(v.tabela_preco_nome, '(sem tabela)') AS tabela_preco_nome,
    COUNT(*)::bigint AS notas,
    COALESCE(SUM(v.total_nota), 0) AS faturamento
  FROM public.v_vendas v
  WHERE (p_de IS NULL OR v.data_emissao >= p_de)
    AND (p_ate IS NULL OR v.data_emissao <= p_ate)
    AND (p_empresa IS NULL OR v.empresa_id = p_empresa)
  GROUP BY v.tabela_preco_id, v.tabela_preco_nome
  ORDER BY faturamento DESC;
$$;

GRANT EXECUTE ON FUNCTION public.vendas_share_tabela_preco(date, date, int) TO authenticated;
