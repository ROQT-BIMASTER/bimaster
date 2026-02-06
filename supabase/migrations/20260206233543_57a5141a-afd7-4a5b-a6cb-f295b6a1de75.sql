-- Adicionar coluna avatar_url na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Criar bucket para avatares
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para avatares
CREATE POLICY "Avatares são públicos para leitura"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Usuários autenticados podem fazer upload do próprio avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Usuários podem atualizar próprio avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Usuários podem deletar próprio avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins podem gerenciar avatares de qualquer usuário
CREATE POLICY "Admins gerenciam todos os avatares"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  bucket_id = 'avatars' 
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);