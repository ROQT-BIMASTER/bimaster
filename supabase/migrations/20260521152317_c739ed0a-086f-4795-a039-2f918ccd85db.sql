-- 1. Add notion sync columns to briefings (all nullable, backwards compatible)
ALTER TABLE public.briefings
  ADD COLUMN IF NOT EXISTS notion_page_id text,
  ADD COLUMN IF NOT EXISTS notion_page_url text,
  ADD COLUMN IF NOT EXISTS notion_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS notion_last_push_at timestamptz,
  ADD COLUMN IF NOT EXISTS notion_last_pull_at timestamptz,
  ADD COLUMN IF NOT EXISTS notion_page_hash text;

CREATE INDEX IF NOT EXISTS idx_briefings_notion_page_id
  ON public.briefings(notion_page_id)
  WHERE notion_page_id IS NOT NULL;

-- 2. New sync log table (audit, complements legacy notion_export_log)
CREATE TABLE IF NOT EXISTS public.briefing_notion_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id uuid NOT NULL REFERENCES public.briefings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('push','pull','diff')),
  action text NOT NULL CHECK (action IN ('create','update','noop','conflict','error')),
  notion_page_id text,
  fields_changed jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success','error')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_briefing_notion_sync_log_briefing
  ON public.briefing_notion_sync_log(briefing_id, created_at DESC);

ALTER TABLE public.briefing_notion_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner reads own briefing sync log"
  ON public.briefing_notion_sync_log;
CREATE POLICY "owner reads own briefing sync log"
  ON public.briefing_notion_sync_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.briefings b
      WHERE b.id = briefing_notion_sync_log.briefing_id
        AND b.user_id = auth.uid()
    )
  );

-- 3. Backfill: copy last successful page from notion_export_log to briefings
WITH latest AS (
  SELECT DISTINCT ON (briefing_id)
    briefing_id,
    notion_page_id,
    notion_page_url,
    created_at
  FROM public.notion_export_log
  WHERE status = 'success'
    AND notion_page_id IS NOT NULL
  ORDER BY briefing_id, created_at DESC
)
UPDATE public.briefings b
SET
  notion_page_id      = latest.notion_page_id,
  notion_page_url     = latest.notion_page_url,
  notion_last_push_at = latest.created_at,
  notion_synced_at    = latest.created_at
FROM latest
WHERE b.id = latest.briefing_id
  AND b.notion_page_id IS NULL;