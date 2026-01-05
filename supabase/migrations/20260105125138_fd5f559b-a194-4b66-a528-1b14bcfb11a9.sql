-- Corrigir view sync_chunks_progress para SECURITY INVOKER
ALTER VIEW public.sync_chunks_progress SET (security_invoker = on);