-- Criar tabela para posts agendados de redes sociais
CREATE TABLE IF NOT EXISTS public.social_media_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  account_ids UUID[] NOT NULL, -- Array de IDs de contas onde será publicado
  content TEXT NOT NULL,
  media_urls TEXT[] DEFAULT '{}', -- Array de URLs de imagens/vídeos
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'failed')),
  error_message TEXT,
  post_ids JSONB DEFAULT '{}', -- IDs dos posts publicados em cada plataforma
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_social_media_posts_user_id ON public.social_media_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_media_posts_status ON public.social_media_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_media_posts_scheduled_at ON public.social_media_posts(scheduled_at);

-- RLS Policies
ALTER TABLE public.social_media_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own posts"
  ON public.social_media_posts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own posts"
  ON public.social_media_posts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts"
  ON public.social_media_posts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts"
  ON public.social_media_posts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_social_media_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_social_media_posts_updated_at
  BEFORE UPDATE ON public.social_media_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_social_media_posts_updated_at();