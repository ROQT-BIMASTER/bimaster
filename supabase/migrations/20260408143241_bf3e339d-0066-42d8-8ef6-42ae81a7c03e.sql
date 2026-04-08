
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-media', 'post-media', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can view post media"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'post-media');

CREATE POLICY "Authenticated users can upload post media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'post-media');

CREATE POLICY "Authenticated users can update post media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'post-media');
