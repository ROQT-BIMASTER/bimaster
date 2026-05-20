
CREATE TABLE IF NOT EXISTS public.app_release_pins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  min_version TEXT NOT NULL,
  mensagem TEXT,
  criado_por UUID NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_release_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read pins"
  ON public.app_release_pins
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admins insert pins"
  ON public.app_release_pins
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = criado_por);

CREATE INDEX IF NOT EXISTS idx_app_release_pins_criado_em
  ON public.app_release_pins (criado_em DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.app_release_pins;
ALTER TABLE public.app_release_pins REPLICA IDENTITY FULL;
