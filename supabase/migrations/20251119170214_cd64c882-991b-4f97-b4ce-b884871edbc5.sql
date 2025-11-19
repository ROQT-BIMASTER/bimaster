-- Adicionar campos para melhor gerenciamento de múltiplas contas
ALTER TABLE social_media_accounts 
ADD COLUMN IF NOT EXISTS account_name TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS region TEXT,
ADD COLUMN IF NOT EXISTS account_group TEXT;

-- Adicionar constraint de status após criar a coluna
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'social_media_accounts_status_check'
  ) THEN
    ALTER TABLE social_media_accounts 
    ADD CONSTRAINT social_media_accounts_status_check 
    CHECK (status IN ('active', 'error', 'syncing', 'inactive'));
  END IF;
END $$;

-- Criar índice para melhorar performance em queries por usuário e plataforma
CREATE INDEX IF NOT EXISTS idx_social_accounts_user_platform ON social_media_accounts(user_id, platform);

-- Adicionar account_id à tabela de histórico para relacionar com a conta
ALTER TABLE social_media_metrics_history 
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES social_media_accounts(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS comments INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS shares INTEGER DEFAULT 0;

-- Índice para histórico
CREATE INDEX IF NOT EXISTS idx_metrics_history_account ON social_media_metrics_history(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_history_platform ON social_media_metrics_history(platform, created_at DESC);

-- RLS para social_media_accounts (já existe mas vamos garantir)
ALTER TABLE social_media_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own social accounts" ON social_media_accounts;
CREATE POLICY "Users can manage their own social accounts"
ON social_media_accounts
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS para social_media_metrics_history
ALTER TABLE social_media_metrics_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their account metrics history" ON social_media_metrics_history;
CREATE POLICY "Users can view their account metrics history"
ON social_media_metrics_history
FOR SELECT
USING (
  account_id IS NULL OR EXISTS (
    SELECT 1 FROM social_media_accounts
    WHERE social_media_accounts.id = social_media_metrics_history.account_id
    AND social_media_accounts.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "System can insert metrics history" ON social_media_metrics_history;
CREATE POLICY "System can insert metrics history"
ON social_media_metrics_history
FOR INSERT
WITH CHECK (true);

-- Comentários nas colunas
COMMENT ON COLUMN social_media_accounts.account_name IS 'Nome personalizado para identificação da conta (ex: Instagram Loja SP)';
COMMENT ON COLUMN social_media_accounts.status IS 'Status da conta: active, error, syncing, inactive';
COMMENT ON COLUMN social_media_accounts.region IS 'Região ou localização da conta para agrupamento';
COMMENT ON COLUMN social_media_accounts.account_group IS 'Grupo da conta para organização (ex: Lojas Sul, Marketing Nacional)';
COMMENT ON COLUMN social_media_metrics_history.account_id IS 'Referência à conta que gerou estas métricas';