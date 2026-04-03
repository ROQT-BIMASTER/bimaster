
-- Mapping table for ERP categories → chart of accounts v2
CREATE TABLE public.plano_contas_mapeamento_categorias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria_nome TEXT NOT NULL UNIQUE,
  plano_contas_id UUID REFERENCES public.trade_chart_of_accounts(id),
  plano_contas_codigo TEXT,
  plano_contas_nome TEXT,
  confianca NUMERIC(3,2) DEFAULT 0,
  justificativa TEXT,
  revisado_manualmente BOOLEAN DEFAULT false,
  qtd_titulos INTEGER DEFAULT 0,
  valor_medio NUMERIC(15,2) DEFAULT 0,
  top_fornecedores TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.plano_contas_mapeamento_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage mappings"
  ON public.plano_contas_mapeamento_categorias
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Function to bulk-apply mappings to contas_pagar
CREATE OR REPLACE FUNCTION public.aplicar_mapeamento_plano_contas()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  UPDATE contas_pagar cp
  SET
    plano_contas_id = m.plano_contas_id,
    plano_contas_codigo = m.plano_contas_codigo,
    plano_contas_nome = m.plano_contas_nome
  FROM plano_contas_mapeamento_categorias m
  WHERE cp.categoria_nome = m.categoria_nome
    AND m.plano_contas_id IS NOT NULL
    AND (cp.plano_contas_id IS NULL OR cp.plano_contas_id != m.plano_contas_id);

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'updated_count', updated_count
  );
END;
$$;
