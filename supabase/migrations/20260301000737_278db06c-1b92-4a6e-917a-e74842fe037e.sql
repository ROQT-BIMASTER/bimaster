
-- Create bucket for product photos (public for easy display across the system)
INSERT INTO storage.buckets (id, name, public)
VALUES ('fabrica-produto-fotos', 'fabrica-produto-fotos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload product photos
CREATE POLICY "Authenticated users can upload product photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'fabrica-produto-fotos');

-- Allow public read access for product photos (they appear across many screens)
CREATE POLICY "Product photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'fabrica-produto-fotos');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update product photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'fabrica-produto-fotos');

-- Allow authenticated users to delete product photos
CREATE POLICY "Authenticated users can delete product photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'fabrica-produto-fotos');
