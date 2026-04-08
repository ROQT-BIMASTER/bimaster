
CREATE TABLE public.content_intelligence_saves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'patterns',
  data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.content_intelligence_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saves"
  ON public.content_intelligence_saves FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own saves"
  ON public.content_intelligence_saves FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saves"
  ON public.content_intelligence_saves FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_content_intelligence_saves_user ON public.content_intelligence_saves(user_id);
