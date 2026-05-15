ALTER TABLE public.fabrica_empresa_config
ADD COLUMN IF NOT EXISTS incluir_ipi_no_custo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.fabrica_empresa_config.incluir_ipi_no_custo IS
'Quando true, o custo da ficha usado nas Tabelas de Preço inclui IPI Saída (config.ipi_percentual_saida * (totalNF + markupNF)).';
