ALTER TABLE public.sidebar_menu_items REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sidebar_menu_items;