
-- Tabela de boletos vinculada a contas_receber
CREATE TABLE IF NOT EXISTS public.boletos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id TEXT NOT NULL,
  conta_receber_id UUID REFERENCES public.contas_receber(id) ON DELETE SET NULL,
  n_cod_titulo BIGINT,
  c_cod_int_titulo VARCHAR(60),
  link_boleto VARCHAR(500),
  data_emissao DATE,
  numero_boleto VARCHAR(30),
  codigo_barras VARCHAR(70),
  numero_bancario VARCHAR(30),
  per_juros NUMERIC(5,2) DEFAULT 0,
  per_multa NUMERIC(5,2) DEFAULT 0,
  desconto_cond1_data DATE,
  desconto_cond1_valor NUMERIC(15,2),
  desconto_cond2_data DATE,
  desconto_cond2_valor NUMERIC(15,2),
  desconto_cond3_data DATE,
  desconto_cond3_valor NUMERIC(15,2),
  status VARCHAR(20) DEFAULT 'gerado',
  data_vencimento DATE,
  importado_api BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_boletos_empresa_id ON public.boletos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_boletos_conta_receber_id ON public.boletos(conta_receber_id);
CREATE INDEX IF NOT EXISTS idx_boletos_status ON public.boletos(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_boletos_empresa_cod_int ON public.boletos(empresa_id, c_cod_int_titulo) WHERE c_cod_int_titulo IS NOT NULL;

-- Trigger de updated_at
CREATE OR REPLACE TRIGGER set_boletos_updated_at
  BEFORE UPDATE ON public.boletos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_set_audit_on_update();

-- RLS
ALTER TABLE public.boletos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on boletos"
  ON public.boletos FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view boletos"
  ON public.boletos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert boletos"
  ON public.boletos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update boletos"
  ON public.boletos FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
