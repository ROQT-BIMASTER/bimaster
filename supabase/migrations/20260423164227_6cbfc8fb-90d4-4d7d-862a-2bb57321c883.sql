-- Remove the residual broad SELECT policies on the three public buckets.
-- The public CDN endpoint serves files independent of RLS, so this only
-- blocks API/SDK listing (`.list()`), not direct asset URLs.

DROP POLICY IF EXISTS "Authenticated read creative-studio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated view trade assets"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated view trade banners"  ON storage.objects;