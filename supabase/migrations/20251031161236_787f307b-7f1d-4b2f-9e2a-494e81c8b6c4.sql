-- Habilitar Realtime para tabela de pontos
ALTER TABLE public.user_points_history REPLICA IDENTITY FULL;

-- Adicionar tabela à publicação do realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_points_history;

-- Habilitar Realtime para tabela de rankings
ALTER TABLE public.user_rankings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_rankings;