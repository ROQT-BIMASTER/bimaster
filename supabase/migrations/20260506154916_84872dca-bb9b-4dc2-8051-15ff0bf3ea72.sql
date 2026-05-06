
-- Bucket privado para uploads de respostas de formulários dinâmicos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dynamic-form-uploads',
  'dynamic-form-uploads',
  false,
  20971520,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf','application/zip','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword','application/vnd.ms-excel','text/csv','text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- Permitir upload anônimo/autenticado em paths que começam com o form_id (tokens públicos)
-- Path: {form_id}/{timestamp}_{filename}
CREATE POLICY "Anyone can upload form attachments"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'dynamic-form-uploads');

CREATE POLICY "Anyone can read form attachments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'dynamic-form-uploads');

CREATE POLICY "Authenticated can delete own form attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'dynamic-form-uploads' AND owner = auth.uid());
