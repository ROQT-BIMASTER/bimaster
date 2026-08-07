CREATE UNIQUE INDEX IF NOT EXISTS calendario_lembretes_evento_user_key
  ON public.calendario_lembretes (evento_id, user_id)
  WHERE evento_id IS NOT NULL;