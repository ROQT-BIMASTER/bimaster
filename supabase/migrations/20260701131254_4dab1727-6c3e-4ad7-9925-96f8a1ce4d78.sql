DROP POLICY IF EXISTS "china-pareceres select own" ON storage.objects;

CREATE POLICY "china-pareceres select own"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'china-pareceres'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);