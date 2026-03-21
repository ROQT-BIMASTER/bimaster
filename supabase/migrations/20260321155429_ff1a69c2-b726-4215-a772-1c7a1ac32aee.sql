
INSERT INTO storage.buckets (id, name, public) VALUES ('trade-assets', 'trade-assets', true);

CREATE POLICY "Anyone can view trade assets" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'trade-assets');
CREATE POLICY "Authenticated users can upload trade assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'trade-assets');
CREATE POLICY "Users can update own trade assets" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'trade-assets');
CREATE POLICY "Users can delete own trade assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'trade-assets');
