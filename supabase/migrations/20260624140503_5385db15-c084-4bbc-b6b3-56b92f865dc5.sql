
CREATE POLICY "china-pareceres select own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'china-pareceres'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR auth.uid() IS NOT NULL
    )
  );

CREATE POLICY "china-pareceres insert own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'china-pareceres'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "china-pareceres delete own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'china-pareceres'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );
