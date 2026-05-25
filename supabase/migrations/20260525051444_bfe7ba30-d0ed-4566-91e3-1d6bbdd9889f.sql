CREATE OR REPLACE FUNCTION public.get_revisoes_plano_historico_mensal(
  p_plano_id uuid,
  p_meses text[],
  p_empresa_nome text DEFAULT NULL
)
RETURNS TABLE(revisao_id uuid, fornecedor_codigo text, mes text, valor numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
        AND (p_empresa_nome IS NULL OR cp.empresa_nome = p_empresa_nome)
    ), 0) AS valor
  FROM contas_pagar_revisao r
  CROSS JOIN UNNEST(p_meses) AS m(mes)
  WHERE r.plano_id = p_plano_id
    AND r.fornecedor_codigo IS NOT NULL;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_get_revisao_documentos_mes(
  p_fornecedor_codigo text,
  p_mes text,
  p_empresa_nome text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  numero_documento text,
  parcela integer,
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
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    AND (p_empresa_nome IS NULL OR cp.empresa_nome = p_empresa_nome)
  ORDER BY cp.data_pagamento ASC, cp.numero_documento ASC;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_get_filiais_plano_reducao(p_plano_id uuid)
RETURNS TABLE(fornecedor_codigo text, empresa_nome text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT DISTINCT
    cp.fornecedor_codigo::text,
    cp.empresa_nome
  FROM public.contas_pagar cp
  WHERE cp.empresa_nome IS NOT NULL
    AND cp.fornecedor_codigo IN (
      SELECT r.fornecedor_codigo
      FROM public.contas_pagar_revisao r
      WHERE r.plano_id = p_plano_id
        AND r.fornecedor_codigo IS NOT NULL
    );
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_get_filiais_plano_reducao(uuid) TO authenticated;