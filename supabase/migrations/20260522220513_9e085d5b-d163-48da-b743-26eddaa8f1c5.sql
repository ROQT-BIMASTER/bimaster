
-- Fix: scope discovery_searches reads to owner/admin
DROP POLICY IF EXISTS "Authenticated users can read discovery searches" ON public.discovery_searches;
CREATE POLICY "Users read own discovery searches"
ON public.discovery_searches
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- Fix: crm_is_admin must require admin role (not just empresa membership)
CREATE OR REPLACE FUNCTION public.crm_is_admin(_empresa_id integer)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.user_empresas ue
      WHERE ue.user_id = auth.uid()
        AND ue.empresa_id = _empresa_id
    );
$function$;

-- Fix: drop plaintext token column
ALTER TABLE public.team_form_tokens DROP COLUMN IF EXISTS token_plain;
