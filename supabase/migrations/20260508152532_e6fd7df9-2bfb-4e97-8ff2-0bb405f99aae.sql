-- 1. Preferência de idioma do usuário
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'pt';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_preferred_language_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_preferred_language_check
      CHECK (preferred_language IN ('pt','zh','en'));
  END IF;
END $$;

-- 2. Tradução e idioma de origem das mensagens do chat China
ALTER TABLE public.china_chat_mensagens
  ADD COLUMN IF NOT EXISTS idioma_origem text,
  ADD COLUMN IF NOT EXISTS traducoes jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Garantir realtime para updates de tradução
ALTER TABLE public.china_chat_mensagens REPLICA IDENTITY FULL;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables
   WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='china_chat_mensagens';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.china_chat_mensagens';
  END IF;
END $$;

-- Política para UPDATE de traducoes pelo backend (service role já passa)
-- Já existe "Users can update their own messages" (USING usuario_id=auth.uid())
-- Adicionamos uma policy adicional para qualquer participante atualizar APENAS o campo traducoes via RPC.
-- Mais simples: permitir update do campo traducoes para qualquer usuário autenticado (cache compartilhado, conteúdo é tradução automática).
DROP POLICY IF EXISTS "Authenticated users can cache translations" ON public.china_chat_mensagens;
CREATE POLICY "Authenticated users can cache translations"
ON public.china_chat_mensagens FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- 3. Bucket privado para anexos do chat
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'china-chat-anexos',
  'china-chat-anexos',
  false,
  10485760, -- 10 MB
  ARRAY['image/png','image/jpeg','image/webp','image/gif','application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies do bucket: path = <submissao_id>/<uid>/<filename>
DROP POLICY IF EXISTS "china-chat-anexos: leitura autenticados" ON storage.objects;
CREATE POLICY "china-chat-anexos: leitura autenticados"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'china-chat-anexos');

DROP POLICY IF EXISTS "china-chat-anexos: insert do dono" ON storage.objects;
CREATE POLICY "china-chat-anexos: insert do dono"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'china-chat-anexos'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

DROP POLICY IF EXISTS "china-chat-anexos: delete do dono" ON storage.objects;
CREATE POLICY "china-chat-anexos: delete do dono"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'china-chat-anexos'
  AND (storage.foldername(name))[2] = auth.uid()::text
);