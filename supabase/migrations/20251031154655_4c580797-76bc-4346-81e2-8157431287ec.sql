-- Adicionar supervisor_id à tabela prospects
ALTER TABLE public.prospects 
ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Criar índice para melhorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_prospects_supervisor_id ON public.prospects(supervisor_id);

-- Comentário explicativo
COMMENT ON COLUMN public.prospects.supervisor_id IS 'ID do supervisor responsável pelo prospect';