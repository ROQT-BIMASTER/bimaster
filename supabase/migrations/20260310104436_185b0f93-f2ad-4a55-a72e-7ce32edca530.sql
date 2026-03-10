
ALTER TABLE public.china_ordens_compra 
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao text;

ALTER TABLE public.china_ordens_compra 
  ALTER COLUMN status SET DEFAULT 'rascunho';
