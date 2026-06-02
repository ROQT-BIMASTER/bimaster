CREATE OR REPLACE FUNCTION public.user_can_access_secao(_user_id uuid, _secao_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.projeto_secoes ps
      WHERE ps.id = _secao_id
        AND public.user_can_access_projeto(_user_id, ps.projeto_id)
    );
$function$;

REVOKE EXECUTE ON FUNCTION public.user_can_access_secao(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_access_secao(uuid, uuid) TO authenticated, service_role;