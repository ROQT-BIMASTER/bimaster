ALTER TABLE public.briefings
  ADD COLUMN IF NOT EXISTS campo_origens jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_briefings_campo_origens_gin
  ON public.briefings USING gin (campo_origens);

-- Backfill: para cada briefing, marcar como "ia" todos os campos com texto não-vazio no payload.
UPDATE public.briefings b
SET campo_origens = COALESCE(
  (
    SELECT jsonb_object_agg(kv.key, 'ia'::text)
    FROM jsonb_each(b.payload) kv
    WHERE jsonb_typeof(kv.value) = 'string'
      AND length(btrim(kv.value #>> '{}')) > 0
  ),
  '{}'::jsonb
)
WHERE (b.campo_origens = '{}'::jsonb OR b.campo_origens IS NULL)
  AND b.payload IS NOT NULL
  AND jsonb_typeof(b.payload) = 'object';