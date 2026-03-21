
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.orcamentos_caixa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id TEXT NOT NULL,
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  codigo_categoria VARCHAR(20) NOT NULL,
  descricao_categoria TEXT,
  valor_previsto NUMERIC(15,2) NOT NULL DEFAULT 0,
  importado_api BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, ano, mes, codigo_categoria)
);

CREATE INDEX idx_orcamentos_caixa_empresa_periodo ON public.orcamentos_caixa (empresa_id, ano, mes);

ALTER TABLE public.orcamentos_caixa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on orcamentos_caixa"
  ON public.orcamentos_caixa FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read orcamentos_caixa"
  ON public.orcamentos_caixa FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER set_updated_at_orcamentos_caixa
  BEFORE UPDATE ON public.orcamentos_caixa
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_set_updated_at();
