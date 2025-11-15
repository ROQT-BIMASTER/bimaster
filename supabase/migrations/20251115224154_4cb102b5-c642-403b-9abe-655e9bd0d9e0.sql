-- Criar tabela para histórico de métricas das redes sociais
CREATE TABLE IF NOT EXISTS public.social_media_metrics_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  username TEXT NOT NULL,
  followers INTEGER DEFAULT 0,
  posts INTEGER DEFAULT 0,
  engagement NUMERIC(10,2) DEFAULT 0,
  reach INTEGER DEFAULT 0,
  sentiment_score NUMERIC(5,2),
  sentiment_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Criar índices para melhor performance
CREATE INDEX idx_social_metrics_platform ON public.social_media_metrics_history(platform);
CREATE INDEX idx_social_metrics_username ON public.social_media_metrics_history(username);
CREATE INDEX idx_social_metrics_created_at ON public.social_media_metrics_history(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.social_media_metrics_history ENABLE ROW LEVEL SECURITY;

-- Policy para leitura (todos autenticados podem ver)
CREATE POLICY "Authenticated users can view social media metrics"
ON public.social_media_metrics_history
FOR SELECT
TO authenticated
USING (true);

-- Policy para inserção (apenas autenticados podem inserir)
CREATE POLICY "Authenticated users can insert social media metrics"
ON public.social_media_metrics_history
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Criar tabela para configuração de contas sociais
CREATE TABLE IF NOT EXISTS public.social_media_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  username TEXT NOT NULL,
  access_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform, username)
);

-- Índices
CREATE INDEX idx_social_accounts_user ON public.social_media_accounts(user_id);
CREATE INDEX idx_social_accounts_platform ON public.social_media_accounts(platform);

-- RLS
ALTER TABLE public.social_media_accounts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own social accounts"
ON public.social_media_accounts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own social accounts"
ON public.social_media_accounts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own social accounts"
ON public.social_media_accounts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own social accounts"
ON public.social_media_accounts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_social_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_social_accounts_updated_at
BEFORE UPDATE ON public.social_media_accounts
FOR EACH ROW
EXECUTE FUNCTION update_social_accounts_updated_at();