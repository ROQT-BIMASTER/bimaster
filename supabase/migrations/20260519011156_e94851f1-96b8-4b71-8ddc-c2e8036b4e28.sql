ALTER VIEW public.chat_directory SET (security_invoker = false);
GRANT SELECT ON public.chat_directory TO authenticated;