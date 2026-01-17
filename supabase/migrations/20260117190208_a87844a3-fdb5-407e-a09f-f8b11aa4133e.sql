ALTER TABLE contas_receber DROP CONSTRAINT IF EXISTS contas_receber_erp_id_key;
ALTER TABLE contas_receber DROP CONSTRAINT IF EXISTS contas_receber_erp_empresa_unique;
DROP INDEX IF EXISTS idx_contas_receber_erp_empresa;