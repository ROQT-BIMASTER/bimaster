REVOKE ALL ON FUNCTION public.set_projeto_criador_id() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_projeto_criador_id() TO service_role;