-- Create storage bucket for marketing assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marketing-assets', 
  'marketing-assets', 
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm', 'application/pdf']
);

-- RLS policies for marketing-assets bucket
CREATE POLICY "Users can view all marketing assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'marketing-assets');

CREATE POLICY "Authenticated users can upload marketing assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'marketing-assets' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own marketing assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'marketing-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own marketing assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'marketing-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Table to track uploaded assets with metadata
CREATE TABLE public.marketing_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  tipo VARCHAR(50) NOT NULL, -- imagem, video, catalogo, arte, documento
  storage_path TEXT NOT NULL,
  url_publica TEXT NOT NULL,
  tamanho_bytes BIGINT,
  mime_type VARCHAR(100),
  lancamento_id UUID REFERENCES lancamentos_produtos(id) ON DELETE SET NULL,
  tarefa_id UUID REFERENCES lancamentos_tarefas_marketing(id) ON DELETE SET NULL,
  tags TEXT[],
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketing_assets ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Everyone can view marketing assets"
ON public.marketing_assets FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert assets"
ON public.marketing_assets FOR INSERT
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can update their own assets"
ON public.marketing_assets FOR UPDATE
USING (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete their own assets"
ON public.marketing_assets FOR DELETE
USING (auth.uid() = uploaded_by);

-- Index for faster queries
CREATE INDEX idx_marketing_assets_lancamento ON public.marketing_assets(lancamento_id);
CREATE INDEX idx_marketing_assets_tarefa ON public.marketing_assets(tarefa_id);
CREATE INDEX idx_marketing_assets_tipo ON public.marketing_assets(tipo);