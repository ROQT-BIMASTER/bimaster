
ALTER TABLE public.account_classification_rules
  ADD COLUMN IF NOT EXISTS centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE SET NULL;

ALTER TABLE public.account_classification_rules
  DROP CONSTRAINT IF EXISTS account_classification_rules_categoria_nome_fornecedor_nome_key;

-- Unique parcial: um único registro por combinação incluindo centro_custo_id (NULLS distinct)
CREATE UNIQUE INDEX IF NOT EXISTS account_classification_rules_key_v2
  ON public.account_classification_rules (
    categoria_nome,
    COALESCE(fornecedor_nome, ''),
    COALESCE(tipo_documento, ''),
    COALESCE(centro_custo_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE INDEX IF NOT EXISTS idx_account_classification_rules_centro_custo
  ON public.account_classification_rules (centro_custo_id)
  WHERE centro_custo_id IS NOT NULL;
