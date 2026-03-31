
-- Fix remaining errors

-- 1. process_chat_messages: drop the permissive policy that overrides the restrictive one
DROP POLICY IF EXISTS "Authenticated users can read chat messages" ON public.process_chat_messages;

-- 2. projeto_tarefa_messages: already created restricted policy, drop old if still exists
DROP POLICY IF EXISTS "Users can view task messages" ON public.projeto_tarefa_messages;

-- 3. Remove more sensitive tables from Realtime
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime DROP TABLE public.process_chat_messages; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime DROP TABLE public.projeto_tarefa_messages; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime DROP TABLE public.user_rankings; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
