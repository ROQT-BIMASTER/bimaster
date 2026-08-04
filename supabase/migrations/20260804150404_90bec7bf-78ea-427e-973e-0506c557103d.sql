CREATE TABLE public.china_status_filter_prefs (
  user_id UUID NOT NULL,
  escopo TEXT NOT NULL DEFAULT 'china:status',
  buckets TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, escopo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.china_status_filter_prefs TO authenticated;
GRANT ALL ON public.china_status_filter_prefs TO service_role;

ALTER TABLE public.china_status_filter_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário gerencia seus próprios filtros China"
ON public.china_status_filter_prefs
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());