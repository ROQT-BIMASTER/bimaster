REVOKE ALL ON FUNCTION public.user_can_access_secao(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_access_secao(uuid, uuid) TO authenticated;