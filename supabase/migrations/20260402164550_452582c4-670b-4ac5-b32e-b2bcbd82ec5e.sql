ALTER TABLE public.asana_sync_log ADD COLUMN subtasks_synced integer DEFAULT 0;
ALTER TABLE public.asana_sync_log ADD COLUMN attachments_synced integer DEFAULT 0;
ALTER TABLE public.asana_sync_log ADD COLUMN collaborators_synced integer DEFAULT 0;