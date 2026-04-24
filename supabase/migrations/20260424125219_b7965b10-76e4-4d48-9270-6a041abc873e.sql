-- Tabela para persistir narrações geradas
CREATE TABLE public.roteirista_narracoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  roteiro_id UUID NOT NULL REFERENCES public.roteiros_cinematograficos(id) ON DELETE CASCADE,
  cena_index INTEGER NOT NULL,
  voice_id TEXT NOT NULL,
  voice_nome TEXT,
  texto TEXT NOT NULL,
  texto_hash TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'audio/mpeg',
  duracao_ms INTEGER,
  tamanho_bytes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (roteiro_id, cena_index, texto_hash)
);

CREATE INDEX idx_roteirista_narracoes_roteiro ON public.roteirista_narracoes(roteiro_id, cena_index);
CREATE INDEX idx_roteirista_narracoes_user ON public.roteirista_narracoes(user_id);

ALTER TABLE public.roteirista_narracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own narracoes"
  ON public.roteirista_narracoes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own narracoes"
  ON public.roteirista_narracoes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own narracoes"
  ON public.roteirista_narracoes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own narracoes"
  ON public.roteirista_narracoes FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_roteirista_narracoes_updated_at
  BEFORE UPDATE ON public.roteirista_narracoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket privado de armazenamento de MP3s
INSERT INTO storage.buckets (id, name, public)
VALUES ('narracoes-roteirista', 'narracoes-roteirista', false)
ON CONFLICT (id) DO NOTHING;

-- Acesso baseado em pasta = user_id
CREATE POLICY "Users read own narracoes files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'narracoes-roteirista'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users upload own narracoes files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'narracoes-roteirista'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users update own narracoes files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'narracoes-roteirista'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete own narracoes files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'narracoes-roteirista'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );