
ALTER TABLE public.briefings DROP CONSTRAINT IF EXISTS briefings_status_check;
ALTER TABLE public.briefings ADD CONSTRAINT briefings_status_check
  CHECK (status = ANY (ARRAY['rascunho','em_andamento','em_aprovacao','aprovado','rejeitado','final','arquivado']));
