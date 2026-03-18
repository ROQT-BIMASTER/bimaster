
ALTER TABLE public.process_despacho_documento
  ADD COLUMN IF NOT EXISTS prazo_ciencia_horas INT NOT NULL DEFAULT 48,
  ADD COLUMN IF NOT EXISTS ciencia_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ciencia_por UUID,
  ADD COLUMN IF NOT EXISTS ciencia_por_nome TEXT,
  ADD COLUMN IF NOT EXISTS lote_despacho_id UUID;
