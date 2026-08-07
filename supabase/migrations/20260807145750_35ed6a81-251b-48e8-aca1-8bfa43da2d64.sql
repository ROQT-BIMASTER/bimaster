CREATE TABLE public.calendario_ics_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  filtros jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendario_ics_tokens TO authenticated;
GRANT ALL ON public.calendario_ics_tokens TO service_role;

ALTER TABLE public.calendario_ics_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário gerencia o próprio token de agenda"
  ON public.calendario_ics_tokens FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_calendario_ics_tokens_updated_at
  BEFORE UPDATE ON public.calendario_ics_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();