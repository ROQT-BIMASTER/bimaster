-- RPC para histórico mensal de revisões do plano por mês YYYY-MM
CREATE OR REPLACE FUNCTION public.get_revisoes_plano_historico_mensal(
  p_plano_id uuid,
  p_meses text[]
)
RETURNS TABLE (
  revisao_id uuid,
  fornecedor_codigo text,
  mes text,
  valor numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id AS revisao_id,
    r.fornecedor_codigo::text,
    m.mes,
    COALESCE((
      SELECT SUM(cp.valor_pago)
      FROM contas_pagar cp
      WHERE cp.fornecedor_codigo = r.fornecedor_codigo
        AND cp.data_pagamento IS NOT NULL
        AND TO_CHAR(cp.data_pagamento, 'YYYY-MM') = m.mes
    ), 0) AS valor
  FROM contas_pagar_revisao r
  CROSS JOIN UNNEST(p_meses) AS m(mes)
  WHERE r.plano_id = p_plano_id
    AND r.fornecedor_codigo IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_revisoes_plano_historico_mensal(uuid, text[]) TO authenticated;