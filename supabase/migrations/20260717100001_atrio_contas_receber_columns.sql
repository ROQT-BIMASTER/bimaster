-- Fase 1/3: Colunas Atrio em contas_receber
-- Nota: tipo em AR é int32 (diferente de AP onde tipo é string "9")
-- erp_id histórico tem formato "${empresa}-${tipo_text}-${nota}-${seq}-${codigo}" (incompatível com Atrio)
-- Solução: índice único parcial nas colunas atrio_* para upsert sem afetar registros históricos

ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS atrio_tipo        INTEGER,
  ADD COLUMN IF NOT EXISTS atrio_numero      BIGINT,
  ADD COLUMN IF NOT EXISTS atrio_sequencia   INTEGER,
  ADD COLUMN IF NOT EXISTS atrio_cliente_id  BIGINT;

-- Índice único parcial: apenas registros sincronizados via REST API Atrio participam
-- NULLs são distintos no PostgreSQL → múltiplos registros históricos com atrio_numero=NULL não conflitam
CREATE UNIQUE INDEX IF NOT EXISTS idx_cr_atrio_key
  ON public.contas_receber (empresa_id, atrio_tipo, atrio_numero, atrio_sequencia)
  WHERE atrio_numero IS NOT NULL;
