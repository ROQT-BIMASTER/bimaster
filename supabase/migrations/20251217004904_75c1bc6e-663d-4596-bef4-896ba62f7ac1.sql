-- Função otimizada para bulk upsert sem LOOP
CREATE OR REPLACE FUNCTION bulk_upsert_contas_receber_v2(p_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH source_data AS (
    SELECT 
      r->>'erp_id' as erp_id,
      r->>'data_hash' as data_hash,
      (r->>'empresa_id')::integer as empresa_id,
      r->>'empresa_nome' as empresa_nome,
      r->>'tipo_documento' as tipo_documento,
      r->>'numero_documento' as numero_documento,
      COALESCE((r->>'parcela')::integer, 1) as parcela,
      r->>'cliente_codigo' as cliente_codigo,
      r->>'cliente_nome' as cliente_nome,
      COALESCE((r->>'valor_original')::decimal, 0) as valor_original,
      COALESCE((r->>'valor_aberto')::decimal, 0) as valor_aberto,
      COALESCE((r->>'valor_recebido')::decimal, 0) as valor_recebido,
      COALESCE((r->>'valor_juros')::decimal, 0) as valor_juros,
      COALESCE((r->>'valor_desconto')::decimal, 0) as valor_desconto,
      COALESCE((r->>'valor_ajustes')::decimal, 0) as valor_ajustes,
      (r->>'data_emissao')::date as data_emissao,
      (r->>'data_vencimento')::date as data_vencimento,
      (r->>'data_recebimento')::date as data_recebimento,
      r->>'tabela_preco' as tabela_preco,
      r->>'vendedor_nome' as vendedor_nome,
      r->>'vendedor_codigo' as vendedor_codigo,
      r->>'portador_id' as portador_id,
      r->>'portador' as portador,
      r->>'conta' as conta,
      NOW() as sincronizado_em
    FROM jsonb_array_elements(p_records) AS r
  ),
  upserted AS (
    INSERT INTO contas_receber (
      erp_id, data_hash, empresa_id, empresa_nome, tipo_documento, numero_documento,
      parcela, cliente_codigo, cliente_nome, valor_original, valor_aberto, valor_recebido,
      valor_juros, valor_desconto, valor_ajustes, data_emissao, data_vencimento,
      data_recebimento, tabela_preco, vendedor_nome, vendedor_codigo, portador_id,
      portador, conta, sincronizado_em
    )
    SELECT * FROM source_data
    ON CONFLICT (erp_id) DO UPDATE SET
      data_hash = EXCLUDED.data_hash,
      valor_original = EXCLUDED.valor_original,
      valor_aberto = EXCLUDED.valor_aberto,
      valor_recebido = EXCLUDED.valor_recebido,
      valor_juros = EXCLUDED.valor_juros,
      valor_desconto = EXCLUDED.valor_desconto,
      valor_ajustes = EXCLUDED.valor_ajustes,
      data_recebimento = EXCLUDED.data_recebimento,
      sincronizado_em = EXCLUDED.sincronizado_em,
      updated_at = NOW()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM upserted;
  
  RETURN jsonb_build_object('processed', v_count, 'errors', 0);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('processed', 0, 'errors', 1, 'error_message', SQLERRM);
END;
$$;