
-- Fix search_path for all fabrica trigger functions that reference fabrica_tabelas_preco
ALTER FUNCTION public.marcar_tabela_pendente_aprovacao() SET search_path = public;
ALTER FUNCTION public.recalcular_precos_cascata() SET search_path = public;
ALTER FUNCTION public.criar_versao_tabela_preco() SET search_path = public;
ALTER FUNCTION public.registrar_historico_preco() SET search_path = public;
ALTER FUNCTION public.registrar_historico_preco_produto() SET search_path = public;
ALTER FUNCTION public.verificar_margem_baixa() SET search_path = public;
