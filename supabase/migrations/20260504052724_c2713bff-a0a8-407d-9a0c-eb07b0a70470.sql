ALTER TABLE public.kanban_aprovacoes_preferencias
ADD COLUMN IF NOT EXISTS layout text NOT NULL DEFAULT 'jornada';