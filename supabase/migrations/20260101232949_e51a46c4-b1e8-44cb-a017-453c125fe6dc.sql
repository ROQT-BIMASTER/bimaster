-- Add unique constraint on sync_name for upsert operations
ALTER TABLE public.sync_tracking 
ADD CONSTRAINT sync_tracking_sync_name_key UNIQUE (sync_name);