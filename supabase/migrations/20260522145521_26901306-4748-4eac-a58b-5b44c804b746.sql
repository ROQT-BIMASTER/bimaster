ALTER TABLE public.briefing_documentos
  ADD COLUMN IF NOT EXISTS is_oficial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_checklist_item boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'upload';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'briefing_documentos_origem_check'
  ) THEN
    ALTER TABLE public.briefing_documentos
      ADD CONSTRAINT briefing_documentos_origem_check
      CHECK (origem IN ('upload','chat','template','evidencia'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_briefing_doc_evidencia
  ON public.briefing_documentos (briefing_id)
  WHERE categoria = 'evidencia';