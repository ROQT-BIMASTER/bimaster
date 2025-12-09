-- =============================================
-- MIGRAÇÃO DE SEGURANÇA: Substituir exec_sql
-- =============================================

-- 1. Criar função segura específica para bulk insert de contas_receber
-- Esta função faz APENAS upsert na tabela contas_receber, não executa SQL arbitrário
CREATE OR REPLACE FUNCTION public.bulk_upsert_contas_receber(p_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record jsonb;
  v_processed integer := 0;
  v_errors integer := 0;
BEGIN
  -- Iterar sobre os registros
  FOR v_record IN SELECT * FROM jsonb_array_elements(p_records)
  LOOP
    BEGIN
      INSERT INTO contas_receber (
        erp_id, data_hash, empresa_id, empresa_nome, tipo_documento, numero_documento,
        parcela, cliente_codigo, cliente_nome, valor_original, valor_aberto, valor_recebido,
        valor_juros, valor_desconto, valor_ajustes, data_emissao, data_vencimento,
        data_recebimento, tabela_preco, vendedor_nome, vendedor_codigo, portador_id,
        portador, conta, sincronizado_em
      ) VALUES (
        v_record->>'erp_id',
        v_record->>'data_hash',
        (v_record->>'empresa_id')::integer,
        v_record->>'empresa_nome',
        v_record->>'tipo_documento',
        v_record->>'numero_documento',
        COALESCE((v_record->>'parcela')::integer, 1),
        v_record->>'cliente_codigo',
        v_record->>'cliente_nome',
        COALESCE((v_record->>'valor_original')::decimal, 0),
        COALESCE((v_record->>'valor_aberto')::decimal, 0),
        COALESCE((v_record->>'valor_recebido')::decimal, 0),
        COALESCE((v_record->>'valor_juros')::decimal, 0),
        COALESCE((v_record->>'valor_desconto')::decimal, 0),
        COALESCE((v_record->>'valor_ajustes')::decimal, 0),
        (v_record->>'data_emissao')::date,
        (v_record->>'data_vencimento')::date,
        (v_record->>'data_recebimento')::date,
        v_record->>'tabela_preco',
        v_record->>'vendedor_nome',
        v_record->>'vendedor_codigo',
        v_record->>'portador_id',
        v_record->>'portador',
        v_record->>'conta',
        COALESCE((v_record->>'sincronizado_em')::timestamptz, NOW())
      )
      ON CONFLICT (erp_id) DO UPDATE SET
        data_hash = EXCLUDED.data_hash,
        empresa_nome = EXCLUDED.empresa_nome,
        valor_original = EXCLUDED.valor_original,
        valor_aberto = EXCLUDED.valor_aberto,
        valor_recebido = EXCLUDED.valor_recebido,
        valor_juros = EXCLUDED.valor_juros,
        valor_desconto = EXCLUDED.valor_desconto,
        valor_ajustes = EXCLUDED.valor_ajustes,
        data_recebimento = EXCLUDED.data_recebimento,
        sincronizado_em = EXCLUDED.sincronizado_em,
        updated_at = NOW();
      
      v_processed := v_processed + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'processed', v_processed,
    'errors', v_errors
  );
END;
$$;

-- 2. Revogar acesso público à função exec_sql
REVOKE ALL ON FUNCTION public.exec_sql(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.exec_sql(text) FROM anon;
REVOKE ALL ON FUNCTION public.exec_sql(text) FROM authenticated;

-- 3. Criar tabela de log de auditoria para chamadas de API sensíveis
CREATE TABLE IF NOT EXISTS public.api_security_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint text NOT NULL,
  method text NOT NULL,
  ip_address inet,
  user_agent text,
  api_key_used boolean DEFAULT false,
  user_id uuid,
  success boolean DEFAULT true,
  error_message text,
  request_size_bytes integer,
  response_time_ms integer,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on api_security_log
ALTER TABLE public.api_security_log ENABLE ROW LEVEL SECURITY;

-- Only admin/supervisor can view security logs
CREATE POLICY "Admin/supervisor can view security logs"
  ON public.api_security_log
  FOR SELECT
  USING (is_admin_or_supervisor(auth.uid()));

-- 4. Criar índices para performance de auditoria
CREATE INDEX IF NOT EXISTS idx_api_security_log_created_at ON public.api_security_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_security_log_endpoint ON public.api_security_log(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_security_log_success ON public.api_security_log(success) WHERE NOT success;

-- 5. Comentário explicativo
COMMENT ON FUNCTION public.bulk_upsert_contas_receber(jsonb) IS 
'Função segura para bulk insert/update de contas_receber. Substitui exec_sql para operações de sincronização N8N.';