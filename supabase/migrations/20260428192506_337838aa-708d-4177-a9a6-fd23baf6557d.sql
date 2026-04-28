ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS avatar_storage_path text;