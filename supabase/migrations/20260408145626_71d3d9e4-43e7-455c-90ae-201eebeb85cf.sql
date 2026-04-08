CREATE TABLE public.brand_positioning_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  our_brand_id UUID REFERENCES public.our_brands(id) ON DELETE CASCADE,
  competitor_ids UUID[] DEFAULT '{}',
  analysis_result JSONB NOT NULL DEFAULT '{}',
  sources_searched TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_brand_positioning_user ON public.brand_positioning_analyses(user_id);
CREATE INDEX idx_brand_positioning_brand ON public.brand_positioning_analyses(our_brand_id);

ALTER TABLE public.brand_positioning_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analyses"
ON public.brand_positioning_analyses FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analyses"
ON public.brand_positioning_analyses FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own analyses"
ON public.brand_positioning_analyses FOR DELETE
TO authenticated
USING (auth.uid() = user_id);