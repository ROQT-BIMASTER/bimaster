CREATE UNIQUE INDEX IF NOT EXISTS idx_contas_receber_unique_natural 
ON contas_receber (empresa_id, numero_documento, parcela, cliente_codigo, data_emissao, data_vencimento, valor_original);