-- Tabela de log de chunks para rastrear progresso de sincronização
CREATE TABLE IF NOT EXISTS sync_chunks_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entidade VARCHAR(50) NOT NULL,
  empresa_id INTEGER,
  chunk_id INTEGER NOT NULL,
  total_chunks INTEGER,
  registros_recebidos INTEGER NOT NULL,
  registros_processados INTEGER NOT NULL,
  erros INTEGER DEFAULT 0,
  duracao_ms INTEGER,
  status VARCHAR(20) DEFAULT 'success',
  error_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para consultas de progresso
CREATE INDEX IF NOT EXISTS idx_sync_chunks_log_entidade 
ON sync_chunks_log(entidade, empresa_id, created_at DESC);

-- Índice para consultas por chunk
CREATE INDEX IF NOT EXISTS idx_sync_chunks_log_chunk 
ON sync_chunks_log(entidade, chunk_id, created_at DESC);

-- RLS
ALTER TABLE sync_chunks_log ENABLE ROW LEVEL SECURITY;

-- Política para admin/supervisor visualizar logs
CREATE POLICY "Admin e supervisores podem ver logs de sync" 
ON sync_chunks_log FOR SELECT 
USING (public.is_admin_or_supervisor(auth.uid()));