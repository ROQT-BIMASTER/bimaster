ALTER TABLE public.user_central_preferences REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_central_preferences;