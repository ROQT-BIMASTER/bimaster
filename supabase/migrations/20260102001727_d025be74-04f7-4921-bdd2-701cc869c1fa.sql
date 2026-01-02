-- Add missing columns to contas_receber for N8N sync
ALTER TABLE public.contas_receber 
ADD COLUMN IF NOT EXISTS tabela text,
ADD COLUMN IF NOT EXISTS vendedor text,
ADD COLUMN IF NOT EXISTS portador_id text,
ADD COLUMN IF NOT EXISTS portador_nome text,
ADD COLUMN IF NOT EXISTS conta text,
ADD COLUMN IF NOT EXISTS dias_atraso integer DEFAULT 0;

-- Add index for faster lookups on dias_atraso (useful for overdue reports)
CREATE INDEX IF NOT EXISTS idx_contas_receber_dias_atraso ON public.contas_receber(dias_atraso);