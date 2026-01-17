WITH duplicados_para_remover AS (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY empresa_id, numero_documento, parcela, cliente_codigo, data_emissao, data_vencimento, valor_original
        ORDER BY sincronizado_em DESC NULLS LAST, created_at DESC NULLS LAST
      ) as rn
    FROM contas_receber
  ) ranked
  WHERE rn > 1
)
DELETE FROM contas_receber
WHERE id IN (SELECT id FROM duplicados_para_remover);