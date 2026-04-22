
-- Fix 1: marketing_assets — remove public SELECT, restrict to authenticated
DROP POLICY IF EXISTS "Everyone can view marketing assets" ON public.marketing_assets;

CREATE POLICY "Authenticated users can view marketing assets"
ON public.marketing_assets
FOR SELECT
TO authenticated
USING (true);

-- Fix 2: trade_campaign_* tables — remove unconditional USING(true) SELECT policies
-- so the scoped policies (owner/admin) take effect properly.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'trade_campaign_expenses',
        'trade_campaign_sellout_entries',
        'trade_campaign_orders',
        'trade_campaign_products'
      )
      AND cmd = 'SELECT'
      AND qual = 'true'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END
$$;

-- Ensure each table still has at least one safe authenticated SELECT policy
-- (only create a fallback if no SELECT policy remains for that table).
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'trade_campaign_expenses',
    'trade_campaign_sellout_entries',
    'trade_campaign_orders',
    'trade_campaign_products'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND cmd = 'SELECT'
    ) THEN
      EXECUTE format($f$
        CREATE POLICY "Admins and supervisors can view %1$s"
        ON public.%1$I
        FOR SELECT
        TO authenticated
        USING (public.is_admin_or_supervisor(auth.uid()))
      $f$, t);
    END IF;
  END LOOP;
END
$$;

-- Fix 3: email-assets storage bucket — remove public SELECT, restrict to authenticated
DROP POLICY IF EXISTS "Email assets are publicly accessible" ON storage.objects;

CREATE POLICY "Authenticated users can view email assets"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'email-assets');
