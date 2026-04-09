ALTER TABLE public.api_support_messages
ADD COLUMN IF NOT EXISTS ai_suggested_reply text;
