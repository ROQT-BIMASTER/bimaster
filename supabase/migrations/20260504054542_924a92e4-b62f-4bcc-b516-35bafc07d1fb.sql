ALTER TABLE public.kanban_aprovacoes_preferencias
  ADD COLUMN IF NOT EXISTS colunas_config jsonb NOT NULL DEFAULT '{}'::jsonb;