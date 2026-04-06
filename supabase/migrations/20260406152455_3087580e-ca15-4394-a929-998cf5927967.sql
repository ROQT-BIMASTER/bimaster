
CREATE OR REPLACE FUNCTION get_fornecedor_metricas_reducao(p_codigos text[])
RETURNS TABLE(
  fornecedor_codigo text,
  media_mensal numeric,
  ultimo_pagamento date,
  total_12m numeric,
  ativo boolean,
  historico_mensal jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      cp.fornecedor_codigo,
      cp.valor_pago,
      cp.data_pagamento
    FROM contas_pagar cp
    WHERE cp.fornecedor_codigo = ANY(p_codigos)
      AND cp.data_pagamento IS NOT NULL
      AND cp.data_pagamento >= (CURRENT_DATE - INTERVAL '12 months')
  ),
  agg AS (
    SELECT
      b.fornecedor_codigo,
      SUM(b.valor_pago) AS total_12m,
      MAX(b.data_pagamento) AS ultimo_pagamento,
      COUNT(DISTINCT TO_CHAR(b.data_pagamento, 'YYYY-MM')) AS meses_com_pgto
    FROM base b
    GROUP BY b.fornecedor_codigo
  ),
  hist AS (
    SELECT
      b.fornecedor_codigo,
      jsonb_agg(
        jsonb_build_object(
          'mes', sub.mes_label,
          'valor', COALESCE(sub.total, 0)
        ) ORDER BY sub.mes_key
      ) AS historico_mensal
    FROM (SELECT DISTINCT fornecedor_codigo FROM base) b
    CROSS JOIN LATERAL (
      SELECT
        TO_CHAR(m.mes, 'YYYY-MM') AS mes_key,
        TO_CHAR(m.mes, 'Mon/YY') AS mes_label,
        (
          SELECT COALESCE(SUM(b2.valor_pago), 0)
          FROM base b2
          WHERE b2.fornecedor_codigo = b.fornecedor_codigo
            AND TO_CHAR(b2.data_pagamento, 'YYYY-MM') = TO_CHAR(m.mes, 'YYYY-MM')
        ) AS total
      FROM generate_series(
        DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months'),
        DATE_TRUNC('month', CURRENT_DATE),
        '1 month'
      ) AS m(mes)
    ) sub
    GROUP BY b.fornecedor_codigo
  )
  SELECT
    a.fornecedor_codigo::text,
    CASE WHEN a.meses_com_pgto > 0 THEN ROUND(a.total_12m / a.meses_com_pgto, 2) ELSE 0 END AS media_mensal,
    a.ultimo_pagamento,
    COALESCE(a.total_12m, 0) AS total_12m,
    (a.ultimo_pagamento >= CURRENT_DATE - INTERVAL '60 days') AS ativo,
    COALESCE(h.historico_mensal, '[]'::jsonb) AS historico_mensal
  FROM agg a
  LEFT JOIN hist h ON h.fornecedor_codigo = a.fornecedor_codigo;
$$;
