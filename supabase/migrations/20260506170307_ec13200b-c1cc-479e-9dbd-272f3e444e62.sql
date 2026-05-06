CREATE OR REPLACE VIEW public.vw_china_produto_recebimento_kpis AS
SELECT
  s.id                                            AS submissao_id,
  s.produto_codigo,
  s.produto_nome,
  s.status                                        AS status_submissao,
  s.linha_produto,
  COUNT(oc.ordem_compra_id)                       AS qtd_ocs,
  COUNT(*) FILTER (
    WHERE oc.oc_status IS NOT NULL
      AND oc.oc_status NOT IN ('cancelada','concluida')
  )                                               AS qtd_ocs_ativas,
  COALESCE(SUM(oc.qty_pedida), 0)                 AS qty_pedida,
  COALESCE(SUM(oc.qty_embarcada), 0)              AS qty_embarcada,
  COALESCE(SUM(oc.qty_recebida), 0)               AS qty_recebida,
  COALESCE(SUM(oc.saldo_aberto), 0)               AS qty_saldo,
  COALESCE(SUM(oc.qty_avariada), 0)               AS qty_avariada,
  COALESCE(SUM(oc.qty_faltante), 0)               AS qty_faltante,
  MAX(oc.data_emissao)                            AS data_ultima_oc,
  MIN(oc.data_entrega_prevista) FILTER (
    WHERE oc.data_entrega_real IS NULL
  )                                               AS data_proxima_entrega_prevista
FROM public.china_produto_submissoes s
LEFT JOIN public.vw_china_oc_recebimento_kpis oc
  ON oc.submissao_id = s.id
WHERE s.deleted_at IS NULL
GROUP BY s.id, s.produto_codigo, s.produto_nome, s.status, s.linha_produto;