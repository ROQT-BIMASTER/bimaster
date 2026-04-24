-- Tabela de roteiros cinematográficos gerados pelo Roteirista IA
CREATE TABLE public.roteiros_cinematograficos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  titulo TEXT NOT NULL DEFAULT 'Roteiro sem título',
  sinopse TEXT,
  briefing JSONB NOT NULL DEFAULT '{}'::jsonb,
  fontes JSONB NOT NULL DEFAULT '[]'::jsonb,
  roteiro JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'rascunho',
  modelo_usado TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.roteiros_cinematograficos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roteiros"
  ON public.roteiros_cinematograficos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own roteiros"
  ON public.roteiros_cinematograficos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own roteiros"
  ON public.roteiros_cinematograficos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own roteiros"
  ON public.roteiros_cinematograficos FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_roteiros_user_created ON public.roteiros_cinematograficos(user_id, created_at DESC);
CREATE INDEX idx_roteiros_status ON public.roteiros_cinematograficos(user_id, status);

CREATE TRIGGER update_roteiros_cinematograficos_updated_at
  BEFORE UPDATE ON public.roteiros_cinematograficos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();