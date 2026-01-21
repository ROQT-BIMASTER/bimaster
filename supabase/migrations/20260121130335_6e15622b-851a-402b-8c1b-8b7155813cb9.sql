-- =====================================================
-- CORRIGIR LÓGICA DE STATUS - PRIORIZAR valor_aberto
-- =====================================================

-- 1. Corrigir registros que têm valor_aberto > 0 mas status = 'pago'
UPDATE contas_pagar
SET 
  status = CASE 
    WHEN valor_pago > 0 AND valor_aberto > 0 THEN 'parcial'
    WHEN data_vencimento < CURRENT_DATE THEN 'vencido'
    ELSE 'pendente'
  END,
  updated_at = now()
WHERE valor_aberto > 0 
  AND status = 'pago';

-- 2. Corrigir registros que têm valor_aberto = 0 mas não estão como 'pago'
UPDATE contas_pagar
SET 
  status = 'pago',
  updated_at = now()
WHERE valor_aberto = 0 
  AND status != 'pago';

-- 3. Atualizar função bulk_upsert_contas_pagar_v2 com lógica correta
CREATE OR REPLACE FUNCTION bulk_upsert_contas_pagar_v2(p_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted int := 0;
  v_updated int := 0;
  v_skipped int := 0;
  v_start_time timestamptz := clock_timestamp();
BEGIN
  -- Criar tabela temporária para staging
  CREATE TEMP TABLE IF NOT EXISTS temp_contas_pagar_staging (
    erp_id text PRIMARY KEY,
    data_hash text,
    empresa_id int,
    empresa_nome text,
    tipo_documento text,
    numero_documento text,
    parcela int,
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

  -- Limpar staging
  TRUNCATE temp_contas_pagar_staging;

  -- Inserir dados no staging
  INSERT INTO temp_contas_pagar_staging
  SELECT 
    r->>'erp_id',
    r->>'data_hash',
    (r->>'empresa_id')::int,
    r->>'empresa_nome',
    r->>'tipo_documento',
    r->>'numero_documento',
    COALESCE((r->>'parcela')::int, 1),
    r->>'fornecedor_codigo',
    r->>'fornecedor_nome',
    COALESCE((r->>'valor_original')::numeric, 0),
    COALESCE((r->>'valor_aberto')::numeric, 0),
    COALESCE((r->>'valor_pago')::numeric, 0),
    COALESCE((r->>'valor_juros')::numeric, 0),
    COALESCE((r->>'valor_desconto')::numeric, 0),
    COALESCE((r->>'valor_ajustes')::numeric, 0),
    (r->>'data_emissao')::date,
    (r->>'data_vencimento')::date,
    (r->>'data_pagamento')::date,
    r->>'categoria_codigo',
    r->>'categoria_nome',
    r->>'portador',
    r->>'conta'
  FROM jsonb_array_elements(p_records) AS r
  ON CONFLICT (erp_id) DO NOTHING;

  -- INSERT novos registros
  WITH inserted AS (
    INSERT INTO contas_pagar (
      erp_id, data_hash, empresa_id, empresa_nome, tipo_documento, numero_documento,
      parcela, fornecedor_codigo, fornecedor_nome, valor_original, valor_aberto,
      valor_pago, valor_juros, valor_desconto, valor_ajustes, data_emissao,
      data_vencimento, data_pagamento, categoria_codigo, categoria_nome, portador,
      conta, sincronizado_em, status
    )
    SELECT 
      s.erp_id, s.data_hash, s.empresa_id, s.empresa_nome, s.tipo_documento, s.numero_documento,
      s.parcela, s.fornecedor_codigo, s.fornecedor_nome, s.valor_original, s.valor_aberto,
      s.valor_pago, s.valor_juros, s.valor_desconto, s.valor_ajustes, s.data_emissao,
      s.data_vencimento, s.data_pagamento, s.categoria_codigo, s.categoria_nome, s.portador,
      s.conta, now(), 
      -- LÓGICA CORRETA: valor_aberto = 0 é o critério definitivo para PAGO
      CASE 
        WHEN s.valor_aberto = 0 THEN 'pago'
        WHEN s.valor_pago > 0 AND s.valor_aberto > 0 THEN 'parcial'
        WHEN s.data_vencimento < current_date THEN 'vencido'
        ELSE 'pendente'
      END
    FROM temp_contas_pagar_staging s
    LEFT JOIN contas_pagar cp ON cp.erp_id = s.erp_id
    WHERE cp.id IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM inserted;

  -- UPDATE registros que mudaram
  WITH updated AS (
    UPDATE contas_pagar cp
    SET 
      data_hash = s.data_hash,
      empresa_id = s.empresa_id,
      empresa_nome = s.empresa_nome,
      tipo_documento = s.tipo_documento,
      numero_documento = s.numero_documento,
      parcela = s.parcela,
      fornecedor_codigo = s.fornecedor_codigo,
      fornecedor_nome = s.fornecedor_nome,
      valor_original = s.valor_original,
      valor_aberto = s.valor_aberto,
      valor_pago = s.valor_pago,
      valor_juros = s.valor_juros,
      valor_desconto = s.valor_desconto,
      valor_ajustes = s.valor_ajustes,
      data_emissao = s.data_emissao,
      data_vencimento = s.data_vencimento,
      data_pagamento = s.data_pagamento,
      categoria_codigo = s.categoria_codigo,
      categoria_nome = s.categoria_nome,
      portador = s.portador,
      conta = s.conta,
      sincronizado_em = now(),
      updated_at = now(),
      -- LÓGICA CORRETA: valor_aberto = 0 é o critério definitivo para PAGO
      status = CASE 
        WHEN s.valor_aberto = 0 THEN 'pago'
        WHEN s.valor_pago > 0 AND s.valor_aberto > 0 THEN 'parcial'
        WHEN s.data_vencimento < current_date THEN 'vencido'
        ELSE 'pendente'
      END
    FROM temp_contas_pagar_staging s
    WHERE cp.erp_id = s.erp_id
      AND (
        cp.data_hash IS NULL 
        OR cp.data_hash != s.data_hash
        -- Também atualiza se o status calculado for diferente do atual
        OR cp.status != CASE 
          WHEN s.valor_aberto = 0 THEN 'pago'
          WHEN s.valor_pago > 0 AND s.valor_aberto > 0 THEN 'parcial'
          WHEN s.data_vencimento < current_date THEN 'vencido'
          ELSE 'pendente'
        END
      )
    RETURNING 1
  )
  SELECT count(*) INTO v_updated FROM updated;

  -- Calcular skipped
  SELECT count(*) - v_inserted - v_updated INTO v_skipped
  FROM temp_contas_pagar_staging;

  -- Garantir não negativo
  IF v_skipped < 0 THEN
    v_skipped := 0;
  END IF;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'skipped', v_skipped,
    'total', (SELECT count(*) FROM temp_contas_pagar_staging),
    'duration_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::int
  );
END;
$$;