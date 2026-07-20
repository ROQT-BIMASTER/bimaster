-- Fase 1/3: Colunas Atrio em contas_pagar
-- Chave composta Atrio para AP: empresa + tipo (sempre "9") + numero (int64) + sequencia (int32)
-- Índice parcial: NULLs são distintos no PostgreSQL, logo não conflita com registros históricos do SQL Server

ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS atrio_tipo        TEXT,
  ADD COLUMN IF NOT EXISTS atrio_numero      BIGINT,
  ADD COLUMN IF NOT EXISTS atrio_sequencia   INTEGER,
  ADD COLUMN IF NOT EXISTS atrio_fornecedor_id BIGINT;

-- Índice único parcial: aplica-se apenas a registros sincronizados via API Atrio
-- Registros históricos (atrio_numero IS NULL) não participam do índice → sem conflito de duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS idx_cp_atrio_key
  ON public.contas_pagar (empresa_id, atrio_tipo, atrio_numero, atrio_sequencia)
  WHERE atrio_numero IS NOT NULL;
