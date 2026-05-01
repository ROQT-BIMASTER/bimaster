-- Tabela de análises de IA da integração ShipsGo
CREATE TABLE public.shipsgo_ia_analises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  model text NOT NULL,
  payload_operacional jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_tecnico jsonb NOT NULL DEFAULT '{}'::jsonb,
  relatorio_md text NOT NULL DEFAULT '',
  plano_autofix jsonb NOT NULL DEFAULT '[]'::jsonb,
  resumo jsonb NOT NULL DEFAULT '{}'::jsonb,
  aplicado_em timestamptz,
  aplicado_por uuid,
  resultado_autofix jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shipsgo_ia_analises ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver/criar/atualizar
CREATE POLICY "shipsgo_ia_analises_admin_select"
  ON public.shipsgo_ia_analises FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "shipsgo_ia_analises_admin_insert"
  ON public.shipsgo_ia_analises FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND created_by = auth.uid());

CREATE POLICY "shipsgo_ia_analises_admin_update"
  ON public.shipsgo_ia_analises FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_shipsgo_ia_analises_created_at
  ON public.shipsgo_ia_analises (created_at DESC);

CREATE TRIGGER update_shipsgo_ia_analises_updated_at
  BEFORE UPDATE ON public.shipsgo_ia_analises
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();