CREATE TABLE IF NOT EXISTS public.briefing_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id uuid NOT NULL REFERENCES public.briefings(id) ON DELETE CASCADE,
  round smallint NOT NULL,
  payload_snapshot jsonb NOT NULL,
  body_md text,
  origem text NOT NULL DEFAULT 'envio' CHECK (origem IN ('envio','revisao')),
  motivo_devolucao text,
  rrtask_page_id text,
  enviado_por uuid,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (briefing_id, round)
);

GRANT SELECT, INSERT ON public.briefing_versoes TO authenticated;
GRANT ALL ON public.briefing_versoes TO service_role;

ALTER TABLE public.briefing_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "briefing_versoes_read" ON public.briefing_versoes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.briefings b
    WHERE b.id = briefing_id
      AND (b.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "briefing_versoes_no_update" ON public.briefing_versoes
  FOR UPDATE TO authenticated USING (false);

CREATE POLICY "briefing_versoes_no_delete" ON public.briefing_versoes
  FOR DELETE TO authenticated USING (false);

CREATE INDEX IF NOT EXISTS idx_briefing_versoes_briefing
  ON public.briefing_versoes(briefing_id, round);