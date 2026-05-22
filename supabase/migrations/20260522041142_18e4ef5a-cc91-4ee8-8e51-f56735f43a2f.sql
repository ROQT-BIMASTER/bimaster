REVOKE EXECUTE ON FUNCTION public.next_mp_codigo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_mp_codigo() TO authenticated, service_role;