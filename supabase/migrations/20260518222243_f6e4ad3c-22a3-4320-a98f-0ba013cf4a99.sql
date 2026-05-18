ALTER FUNCTION public._china_label_traducoes_touch() SET search_path = public;
ALTER FUNCTION public.tg_presence_status_updated_at() SET search_path = public;
ALTER VIEW public.chat_directory SET (security_invoker = true);