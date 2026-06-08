ALTER TABLE public.projeto_membro_secoes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projeto_membro_secoes;