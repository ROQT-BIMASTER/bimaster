
-- O índice atual é partial (WHERE erp_id IS NOT NULL), o que impede ON CONFLICT do PostgREST upsert.
-- Substituímos por uma UNIQUE CONSTRAINT total. Como erp_id é gerado a partir de identificadores ERP
-- (id_empresa-nota-pedido-cod_produto), garantimos NOT NULL antes de criar a constraint.

DROP INDEX IF EXISTS public.union_erp_id_unique_idx;

UPDATE public."Union"
SET erp_id = id_empresa::text || '-' || COALESCE(nota,0)::text || '-' || COALESCE(pedido,0)::text || '-' || COALESCE(cod_produto,0)::text || '-' || id::text
WHERE erp_id IS NULL;

ALTER TABLE public."Union" ALTER COLUMN erp_id SET NOT NULL;

ALTER TABLE public."Union" ADD CONSTRAINT union_erp_id_key UNIQUE (erp_id);
