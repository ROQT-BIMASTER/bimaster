-- Add branch_count column to stores table
ALTER TABLE stores 
ADD COLUMN branch_count INTEGER DEFAULT 1;

-- Add branch_count column to store_chains table
ALTER TABLE store_chains 
ADD COLUMN branch_count INTEGER DEFAULT 1;

-- Add comments for documentation
COMMENT ON COLUMN stores.branch_count IS 'Número de lojas/filiais que este registro representa';
COMMENT ON COLUMN store_chains.branch_count IS 'Total de lojas da rede';