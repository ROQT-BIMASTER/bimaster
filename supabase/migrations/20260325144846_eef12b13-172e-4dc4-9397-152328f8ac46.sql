
-- Add visibility columns
ALTER TABLE public.process_chat_messages 
  ADD COLUMN visibilidade text NOT NULL DEFAULT 'publica',
  ADD COLUMN destinatarios_ids uuid[] NOT NULL DEFAULT '{}';

-- Drop existing SELECT policy and recreate with visibility filter
DROP POLICY IF EXISTS "Authenticated users can view process chat messages" ON public.process_chat_messages;

CREATE POLICY "Authenticated users can view process chat messages"
  ON public.process_chat_messages
  FOR SELECT
  TO authenticated
  USING (
    visibilidade = 'publica'
    OR user_id = auth.uid()
    OR auth.uid() = ANY(destinatarios_ids)
  );
