-- Fix hash_api_key with qualified extension reference
DROP FUNCTION IF EXISTS public.hash_api_key(text);
CREATE FUNCTION public.hash_api_key(key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $function$
  SELECT encode(extensions.digest(key, 'sha256'), 'hex');
$function$;