
CREATE TABLE IF NOT EXISTS public.briefing_export_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nome TEXT NOT NULL DEFAULT 'Padrão',
  is_default BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_briefing_export_presets_user
  ON public.briefing_export_presets (user_id);

ALTER TABLE public.briefing_export_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own export presets - select"
  ON public.briefing_export_presets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "own export presets - insert"
  ON public.briefing_export_presets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own export presets - update"
  ON public.briefing_export_presets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "own export presets - delete"
  ON public.briefing_export_presets FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_briefing_export_presets_updated_at
  BEFORE UPDATE ON public.briefing_export_presets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
