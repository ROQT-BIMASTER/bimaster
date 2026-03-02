
-- ============================================================
-- Tabela: fabrica_notas_fiscais_saida (NFs de saída / vendas)
-- ============================================================
CREATE TABLE public.fabrica_notas_fiscais_saida (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_nf TEXT NOT NULL,
  serie TEXT DEFAULT '1',
  data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  cliente_nome TEXT NOT NULL,
  cliente_cnpj TEXT,
  valor_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'emitida',
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fabrica_notas_fiscais_saida ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view NF saida"
  ON public.fabrica_notas_fiscais_saida FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert NF saida"
  ON public.fabrica_notas_fiscais_saida FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update NF saida"
  ON public.fabrica_notas_fiscais_saida FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete NF saida"
  ON public.fabrica_notas_fiscais_saida FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- Tabela: fabrica_itens_nf_saida (itens das NFs de saída)
-- ============================================================
CREATE TABLE public.fabrica_itens_nf_saida (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nota_saida_id UUID NOT NULL REFERENCES public.fabrica_notas_fiscais_saida(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.fabrica_produtos(id),
  descricao TEXT NOT NULL,
  quantidade NUMERIC(15,4) NOT NULL DEFAULT 1,
  valor_unitario NUMERIC(15,4) NOT NULL DEFAULT 0,
  valor_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  -- Campos IVA Dual
  base_cbs NUMERIC(15,2),
  base_ibs NUMERIC(15,2),
  aliquota_cbs NUMERIC(5,2),
  aliquota_ibs NUMERIC(5,2),
  valor_cbs NUMERIC(15,2),
  valor_ibs NUMERIC(15,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fabrica_itens_nf_saida ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view itens NF saida"
  ON public.fabrica_itens_nf_saida FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert itens NF saida"
  ON public.fabrica_itens_nf_saida FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update itens NF saida"
  ON public.fabrica_itens_nf_saida FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete itens NF saida"
  ON public.fabrica_itens_nf_saida FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- Trigger: cálculo automático de IVA nos itens de NF saída
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_calcular_iva_item_nf_saida()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Calcular valor_total do item
  NEW.valor_total := ROUND(NEW.quantidade * NEW.valor_unitario, 2);

  -- Se bases não informadas, usar valor_total
  IF NEW.base_cbs IS NULL THEN
    NEW.base_cbs := NEW.valor_total;
  END IF;
  IF NEW.base_ibs IS NULL THEN
    NEW.base_ibs := NEW.valor_total;
  END IF;

  -- Buscar alíquotas do produto se não informadas
  IF NEW.aliquota_cbs IS NULL AND NEW.produto_id IS NOT NULL THEN
    SELECT aliquota_cbs_padrao, aliquota_ibs_padrao
    INTO NEW.aliquota_cbs, NEW.aliquota_ibs
    FROM fabrica_dados_fiscais_produto
    WHERE produto_id = NEW.produto_id;
  END IF;

  -- Buscar alíquotas ativas da tabela geral se ainda NULL
  IF NEW.aliquota_cbs IS NULL THEN
    SELECT aliquota_cbs, aliquota_ibs
    INTO NEW.aliquota_cbs, NEW.aliquota_ibs
    FROM fabrica_tax_rates_iva
    WHERE ativo = true
    ORDER BY data_inicio DESC
    LIMIT 1;
  END IF;

  -- Calcular valores CBS/IBS
  IF NEW.aliquota_cbs IS NOT NULL THEN
    NEW.valor_cbs := ROUND(NEW.base_cbs * (NEW.aliquota_cbs / 100), 2);
  END IF;
  IF NEW.aliquota_ibs IS NOT NULL THEN
    NEW.valor_ibs := ROUND(NEW.base_ibs * (NEW.aliquota_ibs / 100), 2);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_calcular_iva_item_nf_saida
BEFORE INSERT OR UPDATE ON public.fabrica_itens_nf_saida
FOR EACH ROW
EXECUTE FUNCTION public.fn_calcular_iva_item_nf_saida();
