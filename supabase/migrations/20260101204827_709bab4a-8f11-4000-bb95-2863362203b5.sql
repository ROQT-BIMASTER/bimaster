-- Tabela de cache para N8N
CREATE TABLE IF NOT EXISTS n8n_cache_contas_receber (
    id BIGSERIAL PRIMARY KEY,
    conta_data JSONB NOT NULL,
    erp_id VARCHAR(100),
    cliente_codigo VARCHAR(50),
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para busca rápida
CREATE INDEX idx_n8n_cache_conta_data ON n8n_cache_contas_receber USING GIN (conta_data);
CREATE INDEX idx_n8n_cache_erp_id ON n8n_cache_contas_receber (erp_id);
CREATE INDEX idx_n8n_cache_cliente ON n8n_cache_contas_receber (cliente_codigo);
CREATE INDEX idx_n8n_cache_synced ON n8n_cache_contas_receber (synced_at DESC);

-- Tabela de controle de sincronização N8N
CREATE TABLE IF NOT EXISTS n8n_sync_control (
    table_name VARCHAR(255) PRIMARY KEY,
    last_sync TIMESTAMP WITH TIME ZONE,
    total_records INTEGER DEFAULT 0,
    records_processed INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'idle',
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE n8n_cache_contas_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE n8n_sync_control ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas para service role (N8N usa service key)
CREATE POLICY "Service role full access cache" ON n8n_cache_contas_receber
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access control" ON n8n_sync_control
    FOR ALL USING (true) WITH CHECK (true);

-- Inserir registro inicial de controle
INSERT INTO n8n_sync_control (table_name, status) 
VALUES ('contas_receber', 'idle')
ON CONFLICT (table_name) DO NOTHING;