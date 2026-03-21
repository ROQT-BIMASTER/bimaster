-- Migration 3: SET search_path nas funções SECURITY DEFINER críticas

CREATE OR REPLACE FUNCTION public.fn_criar_titulo_receber(
  p_conta_receber_id uuid,
  p_numero_parcela integer,
  p_valor numeric,
  p_data_vencimento date,
  p_empresa_id integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO parcelas_receber (conta_receber_id, numero_parcela, valor, data_vencimento, empresa_id)
  VALUES (p_conta_receber_id, p_numero_parcela, p_valor, p_data_vencimento, p_empresa_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$func$;

CREATE OR REPLACE FUNCTION public.fn_enfileirar_erp(
  p_empresa_id integer,
  p_tipo text,
  p_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO erp_sync_log (empresa_id, tipo, payload, status)
  VALUES (p_empresa_id, p_tipo, p_payload, 'pendente')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$func$;

CREATE OR REPLACE FUNCTION public.fn_resumo_financeiro(p_empresa_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_pagar', COALESCE((SELECT SUM(valor_total) FROM contas_pagar WHERE empresa_id = p_empresa_id AND status = 'aberto'), 0),
    'total_receber', COALESCE((SELECT SUM(valor_total) FROM contas_receber WHERE empresa_id = p_empresa_id AND status = 'aberto'), 0),
    'saldo_cc', COALESCE((SELECT SUM(saldo_atual) FROM bank_connections WHERE empresa_id = p_empresa_id), 0)
  ) INTO v_result;
  RETURN v_result;
END;
$func$;

CREATE OR REPLACE FUNCTION public.fn_registrar_recebimento(
  p_parcela_id uuid,
  p_valor_recebido numeric,
  p_data_recebimento date,
  p_forma_recebimento text,
  p_conta_corrente_id uuid DEFAULT NULL,
  p_observacao text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO recebimentos (parcela_id, valor_recebido, data_recebimento, forma_recebimento, conta_corrente_id, observacao)
  VALUES (p_parcela_id, p_valor_recebido, p_data_recebimento, p_forma_recebimento, p_conta_corrente_id, p_observacao)
  RETURNING id INTO v_id;
  
  UPDATE parcelas_receber SET status = 'recebido' WHERE id = p_parcela_id;
  
  RETURN v_id;
END;
$func$;

CREATE OR REPLACE FUNCTION public.fn_pesquisar_titulos(
  p_empresa_id integer,
  p_tipo text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF p_tipo = 'pagar' OR p_tipo IS NULL THEN
    RETURN QUERY
    SELECT jsonb_build_object(
      'tipo', 'pagar',
      'id', cp.id,
      'fornecedor', cp.fornecedor_nome,
      'valor', cp.valor_total,
      'vencimento', cp.data_vencimento,
      'status', cp.status
    )
    FROM contas_pagar cp
    WHERE cp.empresa_id = p_empresa_id
      AND (p_status IS NULL OR cp.status = p_status)
      AND (p_data_inicio IS NULL OR cp.data_vencimento >= p_data_inicio)
      AND (p_data_fim IS NULL OR cp.data_vencimento <= p_data_fim);
  END IF;
  
  IF p_tipo = 'receber' OR p_tipo IS NULL THEN
    RETURN QUERY
    SELECT jsonb_build_object(
      'tipo', 'receber',
      'id', cr.id,
      'cliente', cr.cliente_nome,
      'valor', cr.valor_total,
      'vencimento', cr.data_vencimento,
      'status', cr.status
    )
    FROM contas_receber cr
    WHERE cr.empresa_id = p_empresa_id
      AND (p_status IS NULL OR cr.status = p_status)
      AND (p_data_inicio IS NULL OR cr.data_vencimento >= p_data_inicio)
      AND (p_data_fim IS NULL OR cr.data_vencimento <= p_data_fim);
  END IF;
END;
$func$;
