
-- 1. Add INSERT policy for erp_sync_log for authenticated users
CREATE POLICY "erp_sync_log_insert_authenticated"
ON public.erp_sync_log
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 2. Add SELECT policy for erp_sync_log for authenticated users (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'erp_sync_log' AND policyname = 'erp_sync_log_select_authenticated'
  ) THEN
    CREATE POLICY "erp_sync_log_select_authenticated"
    ON public.erp_sync_log
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;

-- 3. Create comprovantes storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes', 'comprovantes', false)
ON CONFLICT (id) DO NOTHING;

-- 4. RLS for comprovantes bucket - authenticated users can upload
CREATE POLICY "comprovantes_insert_authenticated"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'comprovantes');

-- 5. RLS for comprovantes bucket - authenticated users can read
CREATE POLICY "comprovantes_select_authenticated"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'comprovantes');
