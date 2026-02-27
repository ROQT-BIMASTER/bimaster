
-- Add new columns to fabrica_produtos for card view
ALTER TABLE public.fabrica_produtos ADD COLUMN IF NOT EXISTS ncm varchar;
ALTER TABLE public.fabrica_produtos ADD COLUMN IF NOT EXISTS processo_anvisa varchar;
ALTER TABLE public.fabrica_produtos ADD COLUMN IF NOT EXISTS lead_time_dias integer;
ALTER TABLE public.fabrica_produtos ADD COLUMN IF NOT EXISTS custo_unitario numeric;
ALTER TABLE public.fabrica_produtos ADD COLUMN IF NOT EXISTS itens_display integer;
ALTER TABLE public.fabrica_produtos ADD COLUMN IF NOT EXISTS modo_foco boolean DEFAULT false;
