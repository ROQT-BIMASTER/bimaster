-- Criar bucket para fotos de trade marketing
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trade-photos',
  'trade-photos',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso para o bucket trade-photos
CREATE POLICY "Usuários autenticados podem fazer upload de fotos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'trade-photos');

CREATE POLICY "Fotos são publicamente acessíveis"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'trade-photos');

CREATE POLICY "Usuários podem atualizar suas próprias fotos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'trade-photos');

CREATE POLICY "Usuários podem deletar suas próprias fotos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'trade-photos');