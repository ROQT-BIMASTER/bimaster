-- Migration 2: Add missing columns to existing tables + indexes

-- contas_receber: add missing columns
ALTER TABLE contas_receber
  ADD COLUMN IF NOT EXISTS cliente_id UUID,
  ADD COLUMN IF NOT EXISTS conta_bancaria_id UUID,
  ADD COLUMN IF NOT EXISTS descricao VARCHAR(255),
  ADD COLUMN IF NOT EXISTS data_competencia DATE,
  ADD COLUMN IF NOT EXISTS valor_acrescimo NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_liquido NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS num_parcelas SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS categoria VARCHAR(50),
  ADD COLUMN IF NOT EXISTS plano_conta_id UUID,
  ADD COLUMN IF NOT EXISTS centro_custo_id UUID,
  ADD COLUMN IF NOT EXISTS tags TEXT[],
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS codigo_integracao VARCHAR(100),
  ADD COLUMN IF NOT EXISTS enviado_erp BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS inativo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS data_inc DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS hora_inc TIME DEFAULT CURRENT_TIME,
  ADD COLUMN IF NOT EXISTS user_inc VARCHAR(50),
  ADD COLUMN IF NOT EXISTS data_alt DATE,
  ADD COLUMN IF NOT EXISTS hora_alt TIME,
  ADD COLUMN IF NOT EXISTS user_alt VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_car_empresa        ON contas_receber(empresa_id);
CREATE INDEX IF NOT EXISTS idx_car_cliente        ON contas_receber(cliente_id);
CREATE INDEX IF NOT EXISTS idx_car_status         ON contas_receber(status);
CREATE INDEX IF NOT EXISTS idx_car_vencimento     ON contas_receber(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_car_cod_integracao ON contas_receber(codigo_integracao) WHERE codigo_integracao IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_car_inativo        ON contas_receber(inativo);
GRANT SELECT, INSERT, UPDATE ON contas_receber TO anon, authenticated;

-- erp_sync_log: add missing columns
ALTER TABLE erp_sync_log
  ADD COLUMN IF NOT EXISTS tabela_origem VARCHAR(50),
  ADD COLUMN IF NOT EXISTS registro_id UUID,
  ADD COLUMN IF NOT EXISTS payload_enviado JSONB,
  ADD COLUMN IF NOT EXISTS resposta_erp JSONB,
  ADD COLUMN IF NOT EXISTS codigo_erp VARCHAR(100),
  ADD COLUMN IF NOT EXISTS max_tentativas SMALLINT NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS proximo_envio TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS enviado_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_esl_status        ON erp_sync_log(sync_status);
CREATE INDEX IF NOT EXISTS idx_esl_tabela        ON erp_sync_log(tabela_origem, registro_id);
CREATE INDEX IF NOT EXISTS idx_esl_empresa       ON erp_sync_log(empresa_id);
CREATE INDEX IF NOT EXISTS idx_esl_proximo_envio ON erp_sync_log(proximo_envio) WHERE sync_status = 'pendente';
GRANT SELECT, INSERT, UPDATE ON erp_sync_log TO anon, authenticated;