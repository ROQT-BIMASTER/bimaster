GRANT SELECT, INSERT, UPDATE, DELETE ON public.projetos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_membros TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_secoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_tarefas TO authenticated;

GRANT ALL ON public.projetos TO service_role;
GRANT ALL ON public.projeto_membros TO service_role;
GRANT ALL ON public.projeto_secoes TO service_role;
GRANT ALL ON public.projeto_tarefas TO service_role;

REVOKE ALL ON public.projetos FROM anon;
REVOKE ALL ON public.projeto_membros FROM anon;
REVOKE ALL ON public.projeto_secoes FROM anon;
REVOKE ALL ON public.projeto_tarefas FROM anon;

REVOKE EXECUTE ON FUNCTION public.get_or_create_projeto_pessoal() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_or_create_projeto_pessoal() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_projeto_pessoal() TO authenticated;