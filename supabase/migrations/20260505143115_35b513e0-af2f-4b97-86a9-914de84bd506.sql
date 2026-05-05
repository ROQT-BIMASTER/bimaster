REVOKE EXECUTE ON FUNCTION public.get_revisoes_plano_historico_mensal(uuid, text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_revisoes_plano_historico_mensal(uuid, text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_revisoes_plano_historico_mensal(uuid, text[]) TO authenticated;