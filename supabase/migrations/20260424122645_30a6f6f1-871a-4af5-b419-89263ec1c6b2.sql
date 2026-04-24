CREATE TABLE public.roteirista_briefing_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  tema TEXT NOT NULL DEFAULT '',
  objetivo TEXT,
  publico_alvo TEXT,
  tom TEXT NOT NULL DEFAULT 'cinematográfico',
  duracao_total INTEGER NOT NULL DEFAULT 30,
  numero_cenas INTEGER NOT NULL DEFAULT 5,
  formato TEXT NOT NULL DEFAULT '9:16',
  paleta_cores TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.roteirista_briefing_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own briefing templates"
ON public.roteirista_briefing_templates FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users create own briefing templates"
ON public.roteirista_briefing_templates FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own briefing templates"
ON public.roteirista_briefing_templates FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own briefing templates"
ON public.roteirista_briefing_templates FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_roteirista_briefing_templates_user
ON public.roteirista_briefing_templates(user_id, created_at DESC);

CREATE TRIGGER update_roteirista_briefing_templates_updated_at
BEFORE UPDATE ON public.roteirista_briefing_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();