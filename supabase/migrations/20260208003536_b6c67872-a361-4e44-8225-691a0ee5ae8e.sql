-- Add entity type tracking columns to trade_financial_entries
-- entity_type: 'cliente' or 'fornecedor' flag
-- cliente_id: FK to clientes table
-- fornecedor_id: FK to fabrica_fornecedores table

ALTER TABLE public.trade_financial_entries
  ADD COLUMN entity_type varchar(20) DEFAULT NULL,
  ADD COLUMN cliente_id uuid DEFAULT NULL REFERENCES public.clientes(id),
  ADD COLUMN fornecedor_id uuid DEFAULT NULL REFERENCES public.fabrica_fornecedores(id);

-- Add index for queries filtering by entity
CREATE INDEX idx_trade_fin_entries_entity_type ON public.trade_financial_entries(entity_type);
CREATE INDEX idx_trade_fin_entries_cliente_id ON public.trade_financial_entries(cliente_id);
CREATE INDEX idx_trade_fin_entries_fornecedor_id ON public.trade_financial_entries(fornecedor_id);

-- Add check constraint to ensure consistency
ALTER TABLE public.trade_financial_entries
  ADD CONSTRAINT chk_entity_consistency CHECK (
    (entity_type IS NULL AND cliente_id IS NULL AND fornecedor_id IS NULL)
    OR (entity_type = 'cliente' AND cliente_id IS NOT NULL AND fornecedor_id IS NULL)
    OR (entity_type = 'fornecedor' AND fornecedor_id IS NOT NULL AND cliente_id IS NULL)
  );