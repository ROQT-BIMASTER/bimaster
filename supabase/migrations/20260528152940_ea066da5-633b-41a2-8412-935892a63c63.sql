REVOKE EXECUTE ON FUNCTION public.get_or_create_projeto_pessoal() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_or_create_projeto_pessoal() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_projeto_pessoal() TO authenticated;