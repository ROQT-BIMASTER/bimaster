
-- Fix erp_config_safe — DROP and recreate with security_invoker
DROP VIEW IF EXISTS public.erp_config_safe;
CREATE VIEW public.erp_config_safe
WITH (security_invoker = true)
AS
SELECT id, empresa_id, config_key, config_value, description, is_secret, ativo, updated_at, updated_by
FROM erp_config
WHERE config_key::text <> 'api_key'::text;

-- Fix fabrica-produto-fotos — remove public SELECT
DROP POLICY IF EXISTS "Product photos are publicly accessible" ON storage.objects;

-- Fix social_media_credentials — change from public to authenticated
DROP POLICY IF EXISTS "Users manage own social media credentials" ON public.social_media_credentials;
CREATE POLICY "Users manage own social media credentials"
  ON public.social_media_credentials FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
