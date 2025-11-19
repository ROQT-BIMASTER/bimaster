-- Corrigir search_path da função de atualização
DROP FUNCTION IF EXISTS update_social_media_posts_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION update_social_media_posts_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_social_media_posts_updated_at
  BEFORE UPDATE ON public.social_media_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_social_media_posts_updated_at();