
INSERT INTO storage.buckets (id, name, public)
VALUES ('process-attachments', 'process-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload process attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'process-attachments');

CREATE POLICY "Authenticated users can read process attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'process-attachments');

CREATE POLICY "Authenticated users can delete process attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'process-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
