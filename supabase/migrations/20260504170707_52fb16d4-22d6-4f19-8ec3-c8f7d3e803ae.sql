
CREATE TABLE public.lovable_plan_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano TEXT NOT NULL,
  creditos_mensais INTEGER NOT NULL CHECK (creditos_mensais > 0),
  custo_mensal_brl NUMERIC(12,2) NOT NULL CHECK (custo_mensal_brl >= 0),
  vigente_desde DATE NOT NULL,
  vigente_ate DATE,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.lovable_plan_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read plan config" ON public.lovable_plan_config FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert plan config" ON public.lovable_plan_config FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update plan config" ON public.lovable_plan_config FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete plan config" ON public.lovable_plan_config FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_lovable_plan_config_updated
  BEFORE UPDATE ON public.lovable_plan_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.projeto_creditos_lovable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  mes_referencia DATE NOT NULL,
  creditos INTEGER NOT NULL CHECK (creditos >= 0),
  taxa_brl_por_credito NUMERIC(12,4) NOT NULL CHECK (taxa_brl_por_credito >= 0),
  valor_brl NUMERIC(14,4) GENERATED ALWAYS AS (creditos * taxa_brl_por_credito) STORED,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_projeto_creditos_lovable_projeto ON public.projeto_creditos_lovable(projeto_id);
CREATE INDEX idx_projeto_creditos_lovable_mes ON public.projeto_creditos_lovable(mes_referencia);

ALTER TABLE public.projeto_creditos_lovable ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members or admins read projeto creditos"
  ON public.projeto_creditos_lovable FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR projeto_id IN (SELECT pm.projeto_id FROM public.projeto_membros pm WHERE pm.user_id = auth.uid())
    OR projeto_id IN (SELECT p.id FROM public.projetos p WHERE p.criador_id = auth.uid())
  );

CREATE POLICY "Admins insert projeto creditos" ON public.projeto_creditos_lovable FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update projeto creditos" ON public.projeto_creditos_lovable FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete projeto creditos" ON public.projeto_creditos_lovable FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_projeto_creditos_lovable_updated
  BEFORE UPDATE ON public.projeto_creditos_lovable
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_projeto_investimento_lovable(p_projeto_id UUID)
RETURNS TABLE (
  creditos_total BIGINT,
  valor_total_brl NUMERIC,
  total_lancamentos BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE(SUM(creditos), 0)::BIGINT,
    COALESCE(SUM(valor_brl), 0)::NUMERIC,
    COUNT(*)::BIGINT
  FROM public.projeto_creditos_lovable
  WHERE projeto_id = p_projeto_id
    AND (
      public.has_role(auth.uid(), 'admin')
      OR projeto_id IN (SELECT projeto_id FROM public.projeto_membros WHERE user_id = auth.uid())
      OR projeto_id IN (SELECT id FROM public.projetos WHERE criador_id = auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION public.get_lovable_taxa_brl(p_mes DATE)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (custo_mensal_brl / NULLIF(creditos_mensais, 0))::NUMERIC(12,4)
  FROM public.lovable_plan_config
  WHERE vigente_desde <= p_mes
    AND (vigente_ate IS NULL OR vigente_ate >= p_mes)
  ORDER BY vigente_desde DESC
  LIMIT 1;
$$;
