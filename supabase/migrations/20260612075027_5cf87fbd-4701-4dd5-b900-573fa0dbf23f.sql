DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'china_doc_comentarios'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.china_doc_comentarios';
  END IF;
END$$;
ALTER TABLE public.china_doc_comentarios REPLICA IDENTITY FULL;