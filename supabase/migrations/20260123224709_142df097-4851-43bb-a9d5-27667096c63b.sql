-- Create storage bucket for campaign evidence/photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-evidence', 'campaign-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Anyone can view campaign evidence
CREATE POLICY "Campaign evidence is publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'campaign-evidence');

-- Policy: Authenticated users can upload evidence
CREATE POLICY "Authenticated users can upload campaign evidence" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'campaign-evidence' AND auth.role() = 'authenticated');

-- Policy: Users can update their own uploads
CREATE POLICY "Users can update their campaign evidence" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'campaign-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: Users can delete their own uploads  
CREATE POLICY "Users can delete their campaign evidence" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'campaign-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);