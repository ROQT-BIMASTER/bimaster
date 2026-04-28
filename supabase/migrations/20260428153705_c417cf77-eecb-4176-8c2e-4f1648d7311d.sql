-- Tabela de painéis de Influenciadores
CREATE TABLE IF NOT EXISTS public.influencer_paineis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT NOT NULL DEFAULT '#E91E78',
  icone TEXT NOT NULL DEFAULT 'LayoutGrid',
  compartilhado BOOLEAN NOT NULL DEFAULT FALSE,
  ordem INTEGER NOT NULL DEFAULT 0,
  filtros JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_influencer_paineis_user
  ON public.influencer_paineis(user_id);
CREATE INDEX IF NOT EXISTS idx_influencer_paineis_compartilhado
  ON public.influencer_paineis(compartilhado)
  WHERE compartilhado = TRUE;

ALTER TABLE public.influencer_paineis ENABLE ROW LEVEL SECURITY;

-- SELECT: dono OU compartilhado
CREATE POLICY "Painel: ver proprios ou compartilhados"
ON public.influencer_paineis
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR compartilhado = TRUE);

-- INSERT: apenas dono (auth.uid())
CREATE POLICY "Painel: criar como proprio dono"
ON public.influencer_paineis
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- UPDATE: dono ou admin
CREATE POLICY "Painel: editar proprio ou admin"
ON public.influencer_paineis
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- DELETE: dono ou admin
CREATE POLICY "Painel: excluir proprio ou admin"
ON public.influencer_paineis
FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Trigger updated_at
CREATE TRIGGER trg_influencer_paineis_updated_at
BEFORE UPDATE ON public.influencer_paineis
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Campos opcionais em influencers para segmentação por marca/nicho
ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS marca TEXT,
  ADD COLUMN IF NOT EXISTS nicho TEXT;

CREATE INDEX IF NOT EXISTS idx_influencers_marca ON public.influencers(marca) WHERE marca IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_influencers_nicho ON public.influencers(nicho) WHERE nicho IS NOT NULL;