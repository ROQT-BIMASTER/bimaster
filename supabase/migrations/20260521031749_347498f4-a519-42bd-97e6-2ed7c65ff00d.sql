
REVOKE EXECUTE ON FUNCTION public.calc_completeness(bigint, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calc_completeness(bigint, text, jsonb) TO authenticated, service_role;
