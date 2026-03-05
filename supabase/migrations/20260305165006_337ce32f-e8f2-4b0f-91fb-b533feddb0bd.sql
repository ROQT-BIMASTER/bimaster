
-- Create projeto_briefings table
CREATE TABLE public.projeto_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE CASCADE NOT NULL,
  secao_id uuid REFERENCES public.projeto_secoes(id) ON DELETE CASCADE NOT NULL,
  nome_arquivo text NOT NULL,
  created_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL
);

-- Create projeto_briefing_campos table
CREATE TABLE public.projeto_briefing_campos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id uuid REFERENCES public.projeto_briefings(id) ON DELETE CASCADE NOT NULL,
  categoria text NOT NULL,
  campo text NOT NULL,
  valor text,
  responsabilidade text,
  ordem int DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.projeto_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_briefing_campos ENABLE ROW LEVEL SECURITY;

-- RLS for projeto_briefings
CREATE POLICY "Users can view briefings of their projects"
ON public.projeto_briefings FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND p.criador_id = auth.uid()
));

CREATE POLICY "Users can insert briefings to their projects"
ON public.projeto_briefings FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND p.criador_id = auth.uid())
);

CREATE POLICY "Users can delete their briefings"
ON public.projeto_briefings FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- RLS for projeto_briefing_campos
CREATE POLICY "Users can view briefing campos"
ON public.projeto_briefing_campos FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.projeto_briefings b
  JOIN public.projetos p ON p.id = b.projeto_id
  WHERE b.id = briefing_id AND p.criador_id = auth.uid()
));

CREATE POLICY "Users can insert briefing campos"
ON public.projeto_briefing_campos FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.projeto_briefings b
  JOIN public.projetos p ON p.id = b.projeto_id
  WHERE b.id = briefing_id AND p.criador_id = auth.uid()
));

CREATE POLICY "Users can delete briefing campos"
ON public.projeto_briefing_campos FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.projeto_briefings b
  JOIN public.projetos p ON p.id = b.projeto_id
  WHERE b.id = briefing_id AND p.criador_id = auth.uid()
));
