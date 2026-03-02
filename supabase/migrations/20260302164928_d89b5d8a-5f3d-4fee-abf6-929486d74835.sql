
-- =============================================
-- REFORMA TRIBUTÁRIA IVA DUAL (CBS/IBS)
-- Migration segura e reversível
-- =============================================

-- 1. Tabela de alíquotas IVA
CREATE TABLE IF NOT EXISTS public.fabrica_tax_rates_iva (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_regra TEXT NOT NULL,
  aliquota_cbs NUMERIC(5,2) NOT NULL DEFAULT 0,
  aliquota_ibs NUMERIC(5,2) NOT NULL DEFAULT 0,
  data_inicio DATE NOT NULL,
  data_fim DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- RLS para fabrica_tax_rates_iva
ALTER TABLE public.fabrica_tax_rates_iva ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tax rates iva"
  ON public.fabrica_tax_rates_iva FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert tax rates iva"
  ON public.fabrica_tax_rates_iva FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update tax rates iva"
  ON public.fabrica_tax_rates_iva FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete tax rates iva"
  ON public.fabrica_tax_rates_iva FOR DELETE
  TO authenticated USING (true);

-- 2. Feature flag na config da empresa
ALTER TABLE public.fabrica_empresa_config
  ADD COLUMN IF NOT EXISTS iva_dual_habilitado BOOLEAN DEFAULT false;

-- 3. Campos IVA em fabrica_itens_nf
ALTER TABLE public.fabrica_itens_nf
  ADD COLUMN IF NOT EXISTS base_cbs NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS base_ibs NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS aliquota_cbs NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS aliquota_ibs NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS valor_cbs NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS valor_ibs NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS elegivel_credito_iva BOOLEAN DEFAULT true;

-- 4. Campos IVA padrão em fabrica_dados_fiscais_produto
ALTER TABLE public.fabrica_dados_fiscais_produto
  ADD COLUMN IF NOT EXISTS aliquota_cbs_padrao NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS aliquota_ibs_padrao NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS elegivel_credito_iva BOOLEAN DEFAULT true;

-- 5. Trigger para cálculo automático de CBS/IBS em itens de NF
CREATE OR REPLACE FUNCTION public.calcular_iva_item_nf()
RETURNS TRIGGER AS $$
BEGIN
  -- Só calcula se tiver base e alíquota
  IF NEW.base_cbs IS NOT NULL AND NEW.aliquota_cbs IS NOT NULL THEN
    IF NEW.elegivel_credito_iva = true THEN
      NEW.valor_cbs := ROUND(NEW.base_cbs * (NEW.aliquota_cbs / 100), 2);
    ELSE
      NEW.valor_cbs := 0;
    END IF;
  END IF;

  IF NEW.base_ibs IS NOT NULL AND NEW.aliquota_ibs IS NOT NULL THEN
    IF NEW.elegivel_credito_iva = true THEN
      NEW.valor_ibs := ROUND(NEW.base_ibs * (NEW.aliquota_ibs / 100), 2);
    ELSE
      NEW.valor_ibs := 0;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_calcular_iva_item_nf
  BEFORE INSERT OR UPDATE ON public.fabrica_itens_nf
  FOR EACH ROW
  EXECUTE FUNCTION public.calcular_iva_item_nf();
