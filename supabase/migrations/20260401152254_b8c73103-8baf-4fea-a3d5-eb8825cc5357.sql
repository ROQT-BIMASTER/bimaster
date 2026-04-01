
-- Add arquivada and favorita columns
ALTER TABLE public.projeto_atividades 
  ADD COLUMN IF NOT EXISTS arquivada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS favorita boolean NOT NULL DEFAULT false;

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_projeto_atividades_arquivada ON public.projeto_atividades (arquivada) WHERE arquivada = true;
CREATE INDEX IF NOT EXISTS idx_projeto_atividades_favorita ON public.projeto_atividades (favorita) WHERE favorita = true;
