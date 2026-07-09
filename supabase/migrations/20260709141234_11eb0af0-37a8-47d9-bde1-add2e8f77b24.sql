ALTER TABLE public.erp_vendas_item
  ADD COLUMN IF NOT EXISTS cfop_codigo integer,
  ADD COLUMN IF NOT EXISTS ncm text,
  ADD COLUMN IF NOT EXISTS cst_icms text,
  ADD COLUMN IF NOT EXISTS csosn text,
  ADD COLUMN IF NOT EXISTS icms_base numeric(15,2),
  ADD COLUMN IF NOT EXISTS icms_aliquota numeric(7,4),
  ADD COLUMN IF NOT EXISTS icms_valor numeric(15,2),
  ADD COLUMN IF NOT EXISTS st_base numeric(15,2),
  ADD COLUMN IF NOT EXISTS st_valor numeric(15,2),
  ADD COLUMN IF NOT EXISTS ipi_cst text,
  ADD COLUMN IF NOT EXISTS ipi_base numeric(15,2),
  ADD COLUMN IF NOT EXISTS ipi_aliquota numeric(7,4),
  ADD COLUMN IF NOT EXISTS ipi_valor numeric(15,2),
  ADD COLUMN IF NOT EXISTS pis_cst text,
  ADD COLUMN IF NOT EXISTS pis_base numeric(15,2),
  ADD COLUMN IF NOT EXISTS pis_aliquota numeric(7,4),
  ADD COLUMN IF NOT EXISTS pis_valor numeric(15,2),
  ADD COLUMN IF NOT EXISTS cofins_cst text,
  ADD COLUMN IF NOT EXISTS cofins_base numeric(15,2),
  ADD COLUMN IF NOT EXISTS cofins_aliquota numeric(7,4),
  ADD COLUMN IF NOT EXISTS cofins_valor numeric(15,2),
  ADD COLUMN IF NOT EXISTS tributos_valor numeric(15,2);

ALTER TABLE public.erp_vendas
  ADD COLUMN IF NOT EXISTS cfop_codigo integer,
  ADD COLUMN IF NOT EXISTS total_icms_base numeric(15,2),
  ADD COLUMN IF NOT EXISTS total_icms_valor numeric(15,2),
  ADD COLUMN IF NOT EXISTS total_ipi_base numeric(15,2),
  ADD COLUMN IF NOT EXISTS total_ipi_valor numeric(15,2),
  ADD COLUMN IF NOT EXISTS total_st_base numeric(15,2),
  ADD COLUMN IF NOT EXISTS total_st_valor numeric(15,2),
  ADD COLUMN IF NOT EXISTS total_tributos_valor numeric(15,2);

DROP VIEW IF EXISTS public.erp_compras;

CREATE VIEW public.erp_compras
WITH (security_invoker = true) AS
SELECT
  v.id                 AS venda_id,
  v.futura_nota_id,
  v.nro_nota,
  v.serie,
  v.modelo_doc,
  v.cfop_id,
  v.cfop_codigo,
  CASE
    WHEN v.cfop_codigo IN (5910, 6910) THEN 'bonificacao'
    WHEN v.cfop_codigo IN (5551, 6551) THEN 'ativo'
    ELSE 'venda'
  END                  AS natureza,
  v.data_emissao       AS data_entrada,
  v.empresa_destino_id AS empresa_id,
  e.nome               AS empresa_nome,
  v.empresa_id         AS fornecedor_empresa_futura_id,
  v.quantidade,
  v.total_produto,
  v.total_desconto,
  v.total_nota,
  v.total_icms_base,
  v.total_icms_valor,
  v.total_ipi_base,
  v.total_ipi_valor,
  v.total_st_base,
  v.total_st_valor,
  v.total_tributos_valor,
  v.status,
  v.sincronizado_em
FROM public.erp_vendas v
JOIN public.empresas e ON e.id = v.empresa_destino_id
WHERE v.status = 1;