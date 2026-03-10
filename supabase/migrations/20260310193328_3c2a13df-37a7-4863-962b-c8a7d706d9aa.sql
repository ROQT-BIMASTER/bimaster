
UPDATE fabrica_ficha_custo_revisoes
SET snapshot_totais = jsonb_build_object(
  'totalNF', 38.377932,
  'totalServico', 0,
  'totalCondicao', 0,
  'markupNF', 0,
  'markupServico', 0,
  'markupCondicao', 0,
  'markupTotal', 0,
  'subtotal', 38.377932,
  'custoTotal', 38.377932,
  'custoFinalTotal', 38.377932,
  'alteracoes_pendentes', '[]'::jsonb
),
snapshot_insumos = (
  SELECT jsonb_agg(jsonb_build_object(
    'id', id,
    'codigo', codigo,
    'nome', nome,
    'fornecedor', fornecedor,
    'tipo_insumo', tipo_insumo,
    'custo_nf', custo_nf,
    'custo_servico', custo_servico,
    'custo_condicao', custo_condicao,
    'nf_referencia', nf_referencia
  ))
  FROM fabrica_produto_custos
  WHERE produto_id = 'dbc50933-2bbb-4979-9559-6e5c008f51d2'
)
WHERE id = '4e4a1f42-5947-48d4-b9a6-1c727d827b31';
