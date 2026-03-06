
-- Add progress tracking columns to meetings
ALTER TABLE public.meetings 
  ADD COLUMN IF NOT EXISTS progress integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_detail text DEFAULT '';

-- Enable realtime for meetings table
ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;

-- Reset stuck meeting
UPDATE public.meetings SET status = 'draft', progress = 0, progress_detail = '' 
WHERE id = '5e2b53cc-23a3-46ae-8664-168175ce3412' AND status != 'draft';
