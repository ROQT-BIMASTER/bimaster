ALTER TABLE public.erp_pedidos ADD COLUMN IF NOT EXISTS nf_numero        integer;
ALTER TABLE public.erp_pedidos ADD COLUMN IF NOT EXISTS endereco_entrega text;
ALTER TABLE public.erp_pedidos ADD COLUMN IF NOT EXISTS endereco_cep     text;
ALTER TABLE public.erp_pedidos ADD COLUMN IF NOT EXISTS rastreio_link    text;

DROP VIEW IF EXISTS public.v_pedidos;

CREATE VIEW public.v_pedidos AS
SELECT
  p.futura_pedido_id, p.empresa_id, p.nro_pedido, p.tipo_pedido_id,
  p.data_emissao, p.data_movimentacao, p.data_previsao,
  p.cliente_futura_id, p.cliente_nome, p.cliente_cnpj_cpf,
  p.vendedor_futura_id, vd.id AS vendedor_id, vd.nome AS vendedor_nome,
  p.status, p.situacao_id, p.situacao_desc,
  p.cond_pagto_id, p.cond_pagto_desc,
  p.nf_numero, p.endereco_entrega, p.endereco_cep, p.rastreio_link,
  p.etapa, p.etapa_ordem, p.urgente, p.etapa_desde,
  ROUND(EXTRACT(EPOCH FROM (now() - p.etapa_desde)) / 86400.0, 2) AS dias_na_etapa,
  (p.etapa IN ('digitacao','aberto','separacao','separado','conferido')) AS em_andamento,
  p.total_produto, p.total_desconto, p.total_pedido,
  p.observacao, p.data_cancelamento, p.motivo_cancelamento,
  p.sincronizado_em
FROM public.erp_pedidos p
LEFT JOIN public.vendedores vd ON vd.futura_id = p.vendedor_futura_id;

GRANT SELECT ON public.v_pedidos TO authenticated;