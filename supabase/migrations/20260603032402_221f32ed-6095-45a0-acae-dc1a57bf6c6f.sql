ALTER TABLE public.rrtask_sync_log DROP CONSTRAINT IF EXISTS rrtask_sync_log_action_check;

ALTER TABLE public.rrtask_sync_log ADD CONSTRAINT rrtask_sync_log_action_check
  CHECK (action = ANY (ARRAY['create','update','poll','error','devolucao_resend']));