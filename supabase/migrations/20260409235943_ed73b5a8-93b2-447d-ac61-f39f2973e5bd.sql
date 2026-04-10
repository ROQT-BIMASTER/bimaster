
-- Table for creative studio assets metadata
CREATE TABLE public.creative_studio_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  prompt TEXT NOT NULL,
  image_url TEXT,
  storage_path TEXT,
  model_used TEXT NOT NULL DEFAULT 'google/gemini-3.1-flash-image-preview',
  asset_type TEXT NOT NULL DEFAULT 'imagem_gerada',
  category TEXT NOT NULL DEFAULT 'marketing',
  dimensions JSONB,
  format TEXT DEFAULT '1:1',
  parent_asset_id UUID REFERENCES public.creative_studio_assets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.creative_studio_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assets" ON public.creative_studio_assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own assets" ON public.creative_studio_assets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own assets" ON public.creative_studio_assets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own assets" ON public.creative_studio_assets FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_creative_assets_user ON public.creative_studio_assets(user_id);
CREATE INDEX idx_creative_assets_category ON public.creative_studio_assets(category);

CREATE TRIGGER update_creative_studio_assets_updated_at
  BEFORE UPDATE ON public.creative_studio_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('creative-studio', 'creative-studio', true);

CREATE POLICY "Public read creative-studio" ON storage.objects FOR SELECT USING (bucket_id = 'creative-studio');
CREATE POLICY "Auth users upload creative-studio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'creative-studio' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Auth users update creative-studio" ON storage.objects FOR UPDATE USING (bucket_id = 'creative-studio' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Auth users delete creative-studio" ON storage.objects FOR DELETE USING (bucket_id = 'creative-studio' AND auth.uid()::text = (storage.foldername(name))[1]);
