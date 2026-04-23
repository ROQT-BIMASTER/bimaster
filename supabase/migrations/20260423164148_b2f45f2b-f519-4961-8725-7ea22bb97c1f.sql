-- Mitigate "Public Bucket Allows Listing" finding for the three public buckets:
--   creative-studio, trade-assets, trade-banners
--
-- Background:
--   These buckets are set as `public = true` so files are reachable via the
--   public CDN URL (e.g. /storage/v1/object/public/<bucket>/<path>). The
--   public CDN endpoint serves files based ONLY on bucket publicity — it does
--   NOT consult RLS. RLS on `storage.objects` is what governs the LIST API
--   (storage.from(bucket).list()) and the authenticated object endpoint.
--
--   The current SELECT policies are bucket-wide (e.g. `bucket_id = 'x'`)
--   which lets any client enumerate every file in the bucket via list().
--
-- Fix:
--   Replace the broad anon-readable SELECT policies with policies scoped to
--   `authenticated` users only. Public delivery via the CDN URL still works
--   (no RLS check), but anonymous enumeration is blocked.
--
--   For `trade-assets` (which had an explicit "Anyone can view" policy) we
--   tighten to authenticated. If there is a real anonymous read use-case it
--   can be re-introduced later restricted to a known sub-path.

-- 1) creative-studio
DROP POLICY IF EXISTS "Authenticated read creative-studio" ON storage.objects;
CREATE POLICY "Authenticated read creative-studio"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'creative-studio');

-- 2) trade-assets
DROP POLICY IF EXISTS "Anyone can view trade assets" ON storage.objects;
CREATE POLICY "Authenticated view trade assets"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'trade-assets');

-- 3) trade-banners
DROP POLICY IF EXISTS "Authenticated can view trade banners" ON storage.objects;
CREATE POLICY "Authenticated view trade banners"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'trade-banners');