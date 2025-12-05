-- =====================================================
-- TABELA DE CONFIGURAÇÕES DE COBRANÇA AUTOMÁTICA
-- =====================================================

CREATE TABLE IF NOT EXISTS public.configuracoes_cobranca (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key TEXT,
  whatsapp_verify_token TEXT,
  automacao_ativa BOOLEAN DEFAULT false,
  hora_inicio_envio TIME DEFAULT '08:00',
  hora_fim_envio TIME DEFAULT '18:00',
  max_envios_hora INTEGER DEFAULT 50,
  intervalo_minimo_dias INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Garantir apenas uma linha de configuração
CREATE UNIQUE INDEX IF NOT EXISTS idx_configuracoes_cobranca_singleton 
ON public.configuracoes_cobranca ((true));

-- RLS
ALTER TABLE public.configuracoes_cobranca ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver/editar configurações
CREATE POLICY "Admins podem gerenciar configurações de cobrança"
ON public.configuracoes_cobranca
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'supervisor')
  )
);

-- =====================================================
-- ADICIONAR COLUNA fila_id NA TABELA cobrancas_enviadas (se não existir)
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cobrancas_enviadas' AND column_name = 'fila_id'
  ) THEN
    ALTER TABLE public.cobrancas_enviadas 
    ADD COLUMN fila_id UUID REFERENCES fila_cobrancas(id);
  END IF;
END $$;

-- =====================================================
-- FUNÇÃO PARA ENFILEIRAR COBRANÇAS AUTOMATICAMENTE
-- =====================================================

CREATE OR REPLACE FUNCTION public.enfileirar_cobrancas_automaticas()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_enfileirados INTEGER := 0;
  regra RECORD;
  inadimplente RECORD;
  config RECORD;
BEGIN
  -- Buscar configuração
  SELECT * INTO config FROM configuracoes_cobranca LIMIT 1;
  
  -- Se automação não está ativa, retornar
  IF config IS NULL OR NOT config.automacao_ativa THEN
    RAISE NOTICE 'Automação de cobrança não está ativa';
    RETURN 0;
  END IF;
  
  -- Para cada regra ativa
  FOR regra IN 
    SELECT * FROM regras_cobranca 
    WHERE ativo = true 
    ORDER BY prioridade DESC
  LOOP
    -- Buscar inadimplentes que se encaixam na regra
    FOR inadimplente IN
      SELECT 
        cr.id,
        cr.cliente_codigo,
        cr.cliente_nome,
        cr.valor_aberto,
        cr.dias_atraso,
        cr.data_vencimento
      FROM contas_receber cr
      WHERE cr.dias_atraso >= regra.dias_atraso_min
        AND (regra.dias_atraso_max IS NULL OR cr.dias_atraso <= regra.dias_atraso_max)
        AND (regra.valor_minimo IS NULL OR cr.valor_aberto >= regra.valor_minimo)
        AND cr.status != 'recebido'
        -- Não enfileirar se já tem cobrança pendente
        AND NOT EXISTS (
          SELECT 1 FROM fila_cobrancas fc
          WHERE fc.conta_receber_id = cr.id
            AND fc.status IN ('pendente', 'processando')
        )
        -- Respeitar intervalo mínimo entre cobranças
        AND NOT EXISTS (
          SELECT 1 FROM cobrancas_enviadas ce
          WHERE ce.conta_receber_id = cr.id
            AND ce.enviado_em > NOW() - (config.intervalo_minimo_dias || ' days')::INTERVAL
        )
      LIMIT 100 -- Limitar por execução
    LOOP
      -- Enfileirar cobrança
      INSERT INTO fila_cobrancas (
        cliente_codigo, 
        cliente_nome, 
        conta_receber_id, 
        canal, 
        template_id, 
        prioridade,
        agendado_para, 
        max_tentativas,
        status
      ) VALUES (
        inadimplente.cliente_codigo,
        inadimplente.cliente_nome,
        inadimplente.id,
        regra.canal,
        regra.template_id,
        regra.prioridade,
        NOW() + INTERVAL '1 minute',
        3,
        'pendente'
      );
      
      total_enfileirados := total_enfileirados + 1;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Total de cobranças enfileiradas: %', total_enfileirados;
  RETURN total_enfileirados;
END;
$$;

-- =====================================================
-- TABELA DE LOG DE EXECUÇÃO AUTOMÁTICA
-- =====================================================

CREATE TABLE IF NOT EXISTS public.cobranca_execucao_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL, -- 'enfileiramento', 'processamento', 'retry'
  status TEXT DEFAULT 'sucesso',
  registros_processados INTEGER DEFAULT 0,
  erro_mensagem TEXT,
  detalhes JSONB,
  executado_em TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.cobranca_execucao_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver logs de execução"
ON public.cobranca_execucao_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'supervisor')
  )
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_fila_cobrancas_status_canal 
ON fila_cobrancas(status, canal);

CREATE INDEX IF NOT EXISTS idx_fila_cobrancas_agendado 
ON fila_cobrancas(agendado_para) 
WHERE status = 'pendente';

CREATE INDEX IF NOT EXISTS idx_cobrancas_enviadas_fila 
ON cobrancas_enviadas(fila_id);

CREATE INDEX IF NOT EXISTS idx_cobranca_execucao_log_tipo_data 
ON cobranca_execucao_log(tipo, executado_em DESC);