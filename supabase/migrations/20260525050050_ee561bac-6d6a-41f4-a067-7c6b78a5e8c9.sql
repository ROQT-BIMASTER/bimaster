CREATE OR REPLACE FUNCTION public.rpc_get_revisao_documentos_mes(
  p_fornecedor_codigo text,
  p_mes text
)
RETURNS TABLE(
  id uuid,
  numero_documento text,
  parcela int,
  tipo_documento text,
  empresa_nome text,
  data_emissao date,
  data_vencimento date,
  data_pagamento date,
  valor_original numeric,
  valor_pago numeric,
  status text,
  portador text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cp.id,
    cp.numero_documento::text,
    cp.parcela,
    cp.tipo_documento::text,
    cp.empresa_nome,
    cp.data_emissao,
    cp.data_vencimento,
    cp.data_pagamento,
    cp.valor_original,
    cp.valor_pago,
    cp.status::text,
    cp.portador
  FROM public.contas_pagar cp
  WHERE cp.fornecedor_codigo = p_fornecedor_codigo
    AND cp.data_pagamento IS NOT NULL
    AND TO_CHAR(cp.data_pagamento, 'YYYY-MM') = p_mes
  ORDER BY cp.data_pagamento ASC, cp.numero_documento ASC;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_revisao_documentos_mes(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_get_revisao_documentos_mes(text, text) TO authenticated;