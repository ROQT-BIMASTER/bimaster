DROP INDEX IF EXISTS public.account_classification_rules_key_v2;

CREATE UNIQUE INDEX IF NOT EXISTS account_classification_rules_key_v3
ON public.account_classification_rules (
  categoria_nome,
  fornecedor_nome,
  tipo_documento,
  centro_custo_id
) NULLS NOT DISTINCT;