-- =====================================================
-- FUNÇÕES SQL OTIMIZADAS PARA 1M+ DE REGISTROS
-- =====================================================

-- 1. Função bulk upsert para contas_pagar (processamento em batch)
CREATE OR REPLACE FUNCTION bulk_upsert_contas_pagar_v2(p_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
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
    (r->>'parcela')::int,
    r->>'fornecedor_codigo',
    r->>'fornecedor_nome',
    (r->>'valor_original')::numeric,
    (r->>'valor_aberto')::numeric,
    (r->>'valor_pago')::numeric,
    (r->>'valor_juros')::numeric,
    (r->>'valor_desconto')::numeric,
    (r->>'valor_ajustes')::numeric,
    (r->>'data_emissao')::date,
    (r->>'data_vencimento')::date,
    (r->>'data_pagamento')::date,
    r->>'categoria_codigo',
    r->>'categoria_nome',
    r->>'portador',
    r->>'conta'
  FROM jsonb_array_elements(p_records) AS r;

  -- INSERT novos registros (que não existem na tabela principal)
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
      CASE 
        WHEN s.data_pagamento IS NOT NULL THEN 'pago'
        WHEN s.data_vencimento < current_date THEN 'vencido'
        ELSE 'pendente'
      END
    FROM temp_contas_pagar_staging s
    LEFT JOIN contas_pagar cp ON cp.erp_id = s.erp_id
    WHERE cp.id IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM inserted;

  -- UPDATE registros que mudaram (hash diferente)
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
      status = CASE 
        WHEN s.data_pagamento IS NOT NULL THEN 'pago'
        WHEN s.data_vencimento < current_date THEN 'vencido'
        ELSE 'pendente'
      END
    FROM temp_contas_pagar_staging s
    WHERE cp.erp_id = s.erp_id
      AND (cp.data_hash IS NULL OR cp.data_hash != s.data_hash)
    RETURNING 1
  )
  SELECT count(*) INTO v_updated FROM updated;

  -- Calcular skipped
  SELECT count(*) - v_inserted - v_updated INTO v_skipped
  FROM temp_contas_pagar_staging;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'skipped', v_skipped,
    'total', (SELECT count(*) FROM temp_contas_pagar_staging),
    'duration_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::int
  );
END;
$$;

-- 2. Função bulk upsert para movimentações de estoque
CREATE OR REPLACE FUNCTION bulk_upsert_estoque_movimentacoes_v2(p_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_processed int := 0;
  v_errors int := 0;
  v_start_time timestamptz := clock_timestamp();
  v_record jsonb;
  v_distribuidora_id uuid;
  v_prod_dist_id uuid;
  v_saldo_id uuid;
  v_qtd_anterior numeric;
  v_qtd_nova numeric;
BEGIN
  FOR v_record IN SELECT * FROM jsonb_array_elements(p_records)
  LOOP
    BEGIN
      -- Buscar distribuidora
      SELECT id INTO v_distribuidora_id
      FROM estoque_distribuidoras
      WHERE cnpj = regexp_replace(v_record->>'cnpj_distribuidora', '\D', '', 'g');
      
      IF v_distribuidora_id IS NULL THEN
        v_errors := v_errors + 1;
        CONTINUE;
      END IF;

      -- Buscar produto distribuidora
      SELECT id INTO v_prod_dist_id
      FROM estoque_produtos_distribuidora
      WHERE distribuidora_id = v_distribuidora_id
        AND codigo_produto_distribuidora = v_record->>'codigo_produto';
      
      IF v_prod_dist_id IS NULL THEN
        v_errors := v_errors + 1;
        CONTINUE;
      END IF;

      -- Buscar ou criar saldo
      SELECT id, quantidade_disponivel INTO v_saldo_id, v_qtd_anterior
      FROM estoque_saldos
      WHERE distribuidora_id = v_distribuidora_id
        AND produto_distribuidora_id = v_prod_dist_id
        AND COALESCE(lote, '') = COALESCE(v_record->>'lote', '');

      IF v_saldo_id IS NULL THEN
        INSERT INTO estoque_saldos (distribuidora_id, produto_distribuidora_id, quantidade_disponivel, lote, localizacao, data_validade)
        VALUES (v_distribuidora_id, v_prod_dist_id, 0, COALESCE(v_record->>'lote', ''), v_record->>'localizacao', (v_record->>'data_validade')::date)
        RETURNING id, quantidade_disponivel INTO v_saldo_id, v_qtd_anterior;
      END IF;

      -- Calcular nova quantidade
      v_qtd_nova := v_qtd_anterior;
      CASE v_record->>'tipo_movimento'
        WHEN 'entrada' THEN v_qtd_nova := v_qtd_anterior + (v_record->>'quantidade')::numeric;
        WHEN 'saida' THEN v_qtd_nova := v_qtd_anterior - (v_record->>'quantidade')::numeric;
        WHEN 'inventario' THEN v_qtd_nova := (v_record->>'quantidade')::numeric;
        WHEN 'ajuste' THEN v_qtd_nova := v_qtd_anterior + (v_record->>'quantidade')::numeric;
      END CASE;

      -- Atualizar saldo
      UPDATE estoque_saldos SET quantidade_disponivel = v_qtd_nova, updated_at = now() WHERE id = v_saldo_id;

      -- Inserir movimentação
      INSERT INTO estoque_movimentacoes (
        estoque_id, tipo_movimento, quantidade, quantidade_anterior, quantidade_nova,
        custo_unitario, documento_referencia, observacao, origem, destino, n8n_transaction_id
      ) VALUES (
        v_saldo_id, v_record->>'tipo_movimento', ABS((v_record->>'quantidade')::numeric),
        v_qtd_anterior, v_qtd_nova, (v_record->>'custo_unitario')::numeric,
        v_record->>'documento_referencia', v_record->>'observacao',
        v_record->>'origem', v_record->>'destino', v_record->>'transaction_id'
      );

      v_processed := v_processed + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'processed', v_processed,
    'errors', v_errors,
    'total', jsonb_array_length(p_records),
    'duration_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::int
  );
END;
$$;

-- 3. Índices de performance para sincronização
CREATE INDEX IF NOT EXISTS idx_contas_pagar_erp_id_hash ON contas_pagar(erp_id, data_hash);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_sync ON contas_pagar(sincronizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_empresa_vencimento ON contas_pagar(empresa_id, data_vencimento);

-- Índices para estoque
CREATE INDEX IF NOT EXISTS idx_estoque_saldos_lookup ON estoque_saldos(distribuidora_id, produto_distribuidora_id, lote);
CREATE INDEX IF NOT EXISTS idx_estoque_movimentacoes_created ON estoque_movimentacoes(created_at DESC);

-- 4. Tabela de tracking de chunks para sincronização em lotes
CREATE TABLE IF NOT EXISTS sync_chunks_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_id uuid NOT NULL,
  entidade text NOT NULL,
  chunk_number int NOT NULL,
  total_chunks int,
  records_in_chunk int,
  records_processed int DEFAULT 0,
  records_inserted int DEFAULT 0,
  records_updated int DEFAULT 0,
  records_skipped int DEFAULT 0,
  records_error int DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  duration_ms int,
  status text DEFAULT 'processing',
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Índices para tracking
CREATE INDEX IF NOT EXISTS idx_sync_chunks_sync_id ON sync_chunks_tracking(sync_id, chunk_number);
CREATE INDEX IF NOT EXISTS idx_sync_chunks_status ON sync_chunks_tracking(entidade, status, created_at DESC);

-- RLS para sync_chunks_tracking (somente service role)
ALTER TABLE sync_chunks_tracking ENABLE ROW LEVEL SECURITY;

-- 5. View de resumo de chunks em progresso
CREATE OR REPLACE VIEW sync_chunks_progress AS
SELECT 
  sync_id,
  entidade,
  COUNT(*) as total_chunks,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_chunks,
  COUNT(*) FILTER (WHERE status = 'error') as error_chunks,
  SUM(records_processed) as total_processed,
  SUM(records_inserted) as total_inserted,
  SUM(records_updated) as total_updated,
  SUM(records_skipped) as total_skipped,
  MIN(started_at) as started_at,
  MAX(completed_at) as last_completed_at,
  SUM(duration_ms) as total_duration_ms,
  CASE 
    WHEN COUNT(*) = COUNT(*) FILTER (WHERE status = 'completed') THEN 'completed'
    WHEN COUNT(*) FILTER (WHERE status = 'error') > 0 THEN 'partial'
    ELSE 'in_progress'
  END as overall_status
FROM sync_chunks_tracking
GROUP BY sync_id, entidade;