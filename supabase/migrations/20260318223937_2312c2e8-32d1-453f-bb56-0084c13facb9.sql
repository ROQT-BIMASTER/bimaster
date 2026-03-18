
ALTER TABLE public.process_juntadas
  ADD COLUMN IF NOT EXISTS despacho_modulo text,
  ADD COLUMN IF NOT EXISTS despacho_descricao text,
  ADD COLUMN IF NOT EXISTS despacho_data timestamptz,
  ADD COLUMN IF NOT EXISTS despacho_por uuid;
