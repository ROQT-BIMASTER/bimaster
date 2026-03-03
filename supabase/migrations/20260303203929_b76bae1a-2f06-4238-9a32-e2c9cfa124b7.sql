CREATE OR REPLACE FUNCTION public.bulk_upsert_contas_pagar_v2(p_records jsonb, p_force_update boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted int := 0;
  v_updated int := 0;
  v_skipped int := 0;
  v_total int;
  v_today date := current_date;
BEGIN
  v_total := jsonb_array_length(p_records);
  
  CREATE TEMP TABLE IF NOT EXISTS temp_contas_import (
    erp_id text,
    data_hash text,
    empresa_id integer,
    empresa_nome text,
    tipo_documento text,
    numero_documento text,
    parcela integer,
    fornecedor_codigo text,
    fornecedor_nome text,
    valor_original numeric,
    valor_aberto numeric,
    valor_pago numeric,
    valor_juros numeric,
    valor_desconto numeric,
    valor_ajustes numeric,
    data_emissao date,
    data_vencimento date,
    data_pagamento date,
    categoria_codigo text,
    categoria_nome text,
    portador text,
    conta text
  ) ON COMMIT DROP;
  
  TRUNCATE temp_contas_import;
  
  INSERT INTO temp_contas_import
  SELECT 
    (r->>'erp_id')::text,
    (r->>'data_hash')::text,
    (r->>'empresa_id')::integer,
    (r->>'empresa_nome')::text,
    (r->>'tipo_documento')::text,
    (r->>'numero_documento')::text,
    COALESCE((r->>'parcela')::integer, 1),
    (r->>'fornecedor_codigo')::text,
    (r->>'fornecedor_nome')::text,
    COALESCE((r->>'valor_original')::numeric, 0),
    COALESCE((r->>'valor_aberto')::numeric, 0),
    COALESCE((r->>'valor_pago')::numeric, 0),
    COALESCE((r->>'valor_juros')::numeric, 0),
    COALESCE((r->>'valor_desconto')::numeric, 0),
    COALESCE((r->>'valor_ajustes')::numeric, 0),
    (r->>'data_emissao')::date,
    (r->>'data_vencimento')::date,
    (r->>'data_pagamento')::date,
    (r->>'categoria_codigo')::text,
    (r->>'categoria_nome')::text,
    COALESCE((r->>'portador')::text, 'SEM PORTADOR'),
    COALESCE((r->>'conta')::text, 'SEM CONTA')
  FROM jsonb_array_elements(p_records) AS r;
  
  WITH new_records AS (
    INSERT INTO public.contas_pagar (
      erp_id, data_hash, empresa_id, empresa_nome, tipo_documento, numero_documento,
      parcela, fornecedor_codigo, fornecedor_nome, valor_original, valor_aberto,
      valor_pago, valor_juros, valor_desconto, valor_ajustes, data_emissao,
      data_vencimento, data_pagamento, categoria_codigo, categoria_nome, portador, conta,
      status, sincronizado_em
    )
    SELECT 
      t.erp_id, t.data_hash, t.empresa_id, t.empresa_nome, t.tipo_documento, t.numero_documento,
      t.parcela, t.fornecedor_codigo, t.fornecedor_nome, t.valor_original, t.valor_aberto,
      t.valor_pago, t.valor_juros, t.valor_desconto, t.valor_ajustes, t.data_emissao,
      t.data_vencimento, t.data_pagamento, t.categoria_codigo, t.categoria_nome, t.portador, t.conta,
      CASE 
        WHEN t.valor_aberto <= 0 OR t.valor_pago > 0 THEN 'pago'
        WHEN t.data_vencimento < v_today THEN 'vencido'
        ELSE 'pendente'
      END,
      now()
    FROM temp_contas_import t
    LEFT JOIN public.contas_pagar cp ON cp.erp_id = t.erp_id
    WHERE cp.id IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM new_records;
  
  WITH updated_records AS (
    UPDATE public.contas_pagar cp
    SET 
      data_hash = t.data_hash,
      empresa_nome = COALESCE(t.empresa_nome, cp.empresa_nome),
      tipo_documento = COALESCE(t.tipo_documento, cp.tipo_documento),
      numero_documento = COALESCE(t.numero_documento, cp.numero_documento),
      parcela = COALESCE(t.parcela, cp.parcela),
      fornecedor_codigo = COALESCE(t.fornecedor_codigo, cp.fornecedor_codigo),
      fornecedor_nome = COALESCE(t.fornecedor_nome, cp.fornecedor_nome),
      valor_original = t.valor_original,
      valor_aberto = t.valor_aberto,
      valor_pago = t.valor_pago,
      valor_juros = t.valor_juros,
      valor_desconto = t.valor_desconto,
      valor_ajustes = t.valor_ajustes,
      data_emissao = COALESCE(t.data_emissao, cp.data_emissao),
      data_vencimento = COALESCE(t.data_vencimento, cp.data_vencimento),
      data_pagamento = t.data_pagamento,
      categoria_codigo = COALESCE(t.categoria_codigo, cp.categoria_codigo),
      categoria_nome = COALESCE(t.categoria_nome, cp.categoria_nome),
      portador = COALESCE(t.portador, cp.portador),
      conta = COALESCE(t.conta, cp.conta),
      status = CASE 
        WHEN t.valor_aberto <= 0 OR t.valor_pago > 0 THEN 'pago'
        WHEN t.data_vencimento < v_today THEN 'vencido'
        ELSE 'pendente'
      END,
      sincronizado_em = now(),
      updated_at = now()
    FROM temp_contas_import t
    WHERE cp.erp_id = t.erp_id
      AND (
        p_force_update = true
        OR cp.data_hash IS NULL 
        OR cp.data_hash != t.data_hash
        OR cp.status != CASE 
          WHEN t.valor_aberto <= 0 OR t.valor_pago > 0 THEN 'pago'
          WHEN t.data_vencimento < v_today THEN 'vencido'
          ELSE 'pendente'
        END
      )
    RETURNING 1
  )
  SELECT count(*) INTO v_updated FROM updated_records;
  
  v_skipped := v_total - v_inserted - v_updated;
  
  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'skipped', v_skipped,
    'total', v_total,
    'force_update', p_force_update
  );
END;
$$;