
-- Make event-expense-docs bucket public so stored URLs work
UPDATE storage.buckets SET public = true WHERE id = 'event-expense-docs';

-- Make department-expense-docs bucket public so stored URLs work
UPDATE storage.buckets SET public = true WHERE id = 'department-expense-docs';

-- Ensure SELECT policy exists for public access on these buckets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' 
    AND policyname = 'Public read access for event-expense-docs'
  ) THEN
    CREATE POLICY "Public read access for event-expense-docs"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'event-expense-docs');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' 
    AND policyname = 'Public read access for department-expense-docs'
  ) THEN
    CREATE POLICY "Public read access for department-expense-docs"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'department-expense-docs');
  END IF;

  -- Ensure authenticated users can upload to these buckets
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' 
    AND policyname = 'Authenticated users can upload event-expense-docs'
  ) THEN
    CREATE POLICY "Authenticated users can upload event-expense-docs"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'event-expense-docs' AND auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' 
    AND policyname = 'Authenticated users can upload department-expense-docs'
  ) THEN
    CREATE POLICY "Authenticated users can upload department-expense-docs"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'department-expense-docs' AND auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' 
    AND policyname = 'Authenticated users can delete event-expense-docs'
  ) THEN
    CREATE POLICY "Authenticated users can delete event-expense-docs"
      ON storage.objects FOR DELETE
      USING (bucket_id = 'event-expense-docs' AND auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' 
    AND policyname = 'Authenticated users can delete department-expense-docs'
  ) THEN
    CREATE POLICY "Authenticated users can delete department-expense-docs"
      ON storage.objects FOR DELETE
      USING (bucket_id = 'department-expense-docs' AND auth.role() = 'authenticated');
  END IF;
END $$;
