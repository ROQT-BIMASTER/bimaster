-- Create storage bucket for payment chat files
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-chat-files', 'payment-chat-files', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for payment-chat-files bucket
CREATE POLICY "Authenticated users can upload payment chat files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'payment-chat-files');

CREATE POLICY "Authenticated users can read payment chat files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'payment-chat-files');

CREATE POLICY "Authenticated users can delete own payment chat files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'payment-chat-files' AND (storage.foldername(name))[1] = auth.uid()::text);