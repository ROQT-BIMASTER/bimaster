-- ALLOW-DESTRUCTIVE: staging pura refeita pelo conector em ~2 min; chave única grossa causou perda de linhas no smoke.
TRUNCATE public.erp_compras_result;

ALTER TABLE public.erp_compras_result
  ADD COLUMN IF NOT EXISTS fornecedor_id integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aliquota numeric(6,2) NOT NULL DEFAULT 0,
  ALTER COLUMN serie SET DEFAULT '',
  ALTER COLUMN cst SET DEFAULT '';

UPDATE public.erp_compras_result SET serie = '' WHERE serie IS NULL;
ALTER TABLE public.erp_compras_result ALTER COLUMN serie SET NOT NULL;

ALTER TABLE public.erp_compras_result DROP CONSTRAINT IF EXISTS erp_compras_result_uk;

ALTER TABLE public.erp_compras_result
  ADD CONSTRAINT erp_compras_result_chave_livro
  UNIQUE (empresa_result, fornecedor_id, numero_nota, serie, cfop, cst, aliquota, data_entrada);