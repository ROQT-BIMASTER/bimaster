-- Add unique constraint on contas_receber for upsert operations
ALTER TABLE public.contas_receber 
ADD CONSTRAINT contas_receber_erp_empresa_unique UNIQUE (erp_id, empresa_id);

-- Add unique constraint on contas_pagar for upsert operations
ALTER TABLE public.contas_pagar 
ADD CONSTRAINT contas_pagar_erp_empresa_unique UNIQUE (erp_id, empresa_id);

-- Add unique constraint on clientes for upsert operations
ALTER TABLE public.clientes 
ADD CONSTRAINT clientes_codigo_unique UNIQUE (codigo);

-- Add index for faster lookups on data_hash (used for detecting changes)
CREATE INDEX IF NOT EXISTS idx_contas_receber_data_hash ON public.contas_receber(data_hash);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_data_hash ON public.contas_pagar(data_hash);