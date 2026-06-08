CREATE TABLE IF NOT EXISTS public.briefing_tipo_fluxo_padrao (
  tipo text PRIMARY KEY,
  config_id uuid NOT NULL REFERENCES public.fluxo_aprovacao_config(id) ON DELETE RESTRICT,
  prazo_dias_default integer NULL,
  observacao text NULL,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.briefing_tipo_fluxo_padrao TO authenticated;
GRANT ALL ON public.briefing_tipo_fluxo_padrao TO service_role;

ALTER TABLE public.briefing_tipo_fluxo_padrao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read briefing default flows" ON public.briefing_tipo_fluxo_padrao;
CREATE POLICY "Authenticated can read briefing default flows"
  ON public.briefing_tipo_fluxo_padrao
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin or gerente can insert briefing default flows" ON public.briefing_tipo_fluxo_padrao;
CREATE POLICY "Admin or gerente can insert briefing default flows"
  ON public.briefing_tipo_fluxo_padrao
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gerente'::app_role)
  );

DROP POLICY IF EXISTS "Admin or gerente can update briefing default flows" ON public.briefing_tipo_fluxo_padrao;
CREATE POLICY "Admin or gerente can update briefing default flows"
  ON public.briefing_tipo_fluxo_padrao
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gerente'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gerente'::app_role)
  );

DROP POLICY IF EXISTS "Admin or gerente can delete briefing default flows" ON public.briefing_tipo_fluxo_padrao;
CREATE POLICY "Admin or gerente can delete briefing default flows"
  ON public.briefing_tipo_fluxo_padrao
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gerente'::app_role)
  );

DROP TRIGGER IF EXISTS trg_briefing_tipo_fluxo_padrao_updated_at ON public.briefing_tipo_fluxo_padrao;
CREATE TRIGGER trg_briefing_tipo_fluxo_padrao_updated_at
  BEFORE UPDATE ON public.briefing_tipo_fluxo_padrao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();