
CREATE OR REPLACE FUNCTION public.fn_criar_titulo_com_parcelas(
  p_fornecedor_nome TEXT,
  p_fornecedor_codigo TEXT DEFAULT NULL,
  p_tipo_documento TEXT DEFAULT NULL,
  p_numero_documento TEXT DEFAULT NULL,
  p_descricao TEXT DEFAULT NULL,
  p_data_emissao DATE DEFAULT CURRENT_DATE,
  p_data_vencimento DATE DEFAULT NULL,
  p_valor_original NUMERIC DEFAULT 0,
  p_valor_desconto NUMERIC DEFAULT 0,
  p_valor_juros NUMERIC DEFAULT 0,
  p_valor_ajustes NUMERIC DEFAULT 0,
  p_empresa_id INTEGER DEFAULT 1,
  p_empresa_nome TEXT DEFAULT NULL,
  p_numero_parcelas INTEGER DEFAULT 1,
  p_categoria_nome TEXT DEFAULT NULL,
  p_departamento_id UUID DEFAULT NULL,
  p_departamento_nome TEXT DEFAULT NULL,
  p_portador_id UUID DEFAULT NULL,
  p_conta TEXT DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL,
  p_centro_custo TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titulo_id UUID;
  v_erp_id TEXT;
  v_valor_liquido NUMERIC;
  v_valor_parcela NUMERIC;
  v_resto NUMERIC;
  v_venc DATE;
  i INTEGER;
BEGIN
  v_erp_id := 'MAN-' || gen_random_uuid()::text;
  v_valor_liquido := p_valor_original - COALESCE(p_valor_desconto, 0) + COALESCE(p_valor_juros, 0) + COALESCE(p_valor_ajustes, 0);

  INSERT INTO contas_pagar (
    erp_id, empresa_id, empresa_nome, fornecedor_nome, fornecedor_codigo,
    tipo_documento, numero_documento, data_emissao, data_vencimento,
    valor_original, valor_desconto, valor_juros, valor_ajustes,
    valor_aberto, valor_pago, numero_parcela, total_parcelas,
    categoria_nome, departamento_id, departamento_nome,
    portador_id, conta, status, baixa_origem
  ) VALUES (
    v_erp_id, p_empresa_id, p_empresa_nome, p_fornecedor_nome, p_fornecedor_codigo,
    p_tipo_documento, p_numero_documento, p_data_emissao, p_data_vencimento,
    p_valor_original, p_valor_desconto, p_valor_juros, p_valor_ajustes,
    v_valor_liquido, 0, 1, p_numero_parcelas,
    p_categoria_nome, p_departamento_id, p_departamento_nome,
    p_portador_id, p_conta, 'pendente', 'manual'
  )
  RETURNING id INTO v_titulo_id;

  IF p_numero_parcelas > 1 THEN
    v_valor_parcela := ROUND(v_valor_liquido / p_numero_parcelas, 2);
    v_resto := v_valor_liquido - (v_valor_parcela * p_numero_parcelas);

    FOR i IN 1..p_numero_parcelas LOOP
      v_venc := COALESCE(p_data_vencimento, CURRENT_DATE) + ((i - 1) * INTERVAL '1 month');
      INSERT INTO parcelas (
        conta_pagar_id, numero_parcela, valor, data_vencimento, status
      ) VALUES (
        v_titulo_id,
        i,
        CASE WHEN i = p_numero_parcelas THEN v_valor_parcela + v_resto ELSE v_valor_parcela END,
        v_venc::date,
        'pendente'
      );
    END LOOP;
  END IF;

  RETURN v_titulo_id;
END;
$$;
