-- Índice parcial otimizado para listar e contar menções não lidas
-- (usado pela aba Menções, pelo badge @ e pelo digest diário).
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_mentions
  ON public.notifications (user_id, created_at DESC)
  WHERE read = false
    AND type IN ('task_mention', 'chat_mention', 'process_mention');