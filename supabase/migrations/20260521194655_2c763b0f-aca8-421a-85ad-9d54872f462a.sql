
ALTER TABLE public.projeto_membros REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'projeto_membros'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.projeto_membros;
  END IF;
END$$;
