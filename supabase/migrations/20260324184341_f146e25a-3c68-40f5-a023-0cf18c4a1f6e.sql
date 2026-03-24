
ALTER TABLE public.process_modulos_despacho
  ADD COLUMN IF NOT EXISTS ambiente_habilitado boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pode_ciencia boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pode_aprovar boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pode_rejeitar boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pode_juntada boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pode_submeter boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pode_contestar boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pode_replicar boolean NOT NULL DEFAULT true;
