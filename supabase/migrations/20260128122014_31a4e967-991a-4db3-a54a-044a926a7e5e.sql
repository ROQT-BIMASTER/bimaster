
-- Create table for table-specific price limits
-- This allows setting different price limits for each product in each price table
CREATE TABLE public.fabrica_limites_preco_tabela (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tabela_id UUID NOT NULL REFERENCES fabrica_tabelas_preco(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES fabrica_produtos(id) ON DELETE CASCADE,
  preco_maximo NUMERIC(12,2),
  preco_minimo NUMERIC(12,2),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID,
  observacoes TEXT,
  UNIQUE(tabela_id, produto_id)
);

-- Add indexes for performance
CREATE INDEX idx_limites_preco_tabela_tabela ON fabrica_limites_preco_tabela(tabela_id);
CREATE INDEX idx_limites_preco_tabela_produto ON fabrica_limites_preco_tabela(produto_id);
CREATE INDEX idx_limites_preco_tabela_ativo ON fabrica_limites_preco_tabela(ativo) WHERE ativo = true;

-- Enable RLS
ALTER TABLE fabrica_limites_preco_tabela ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view price limits" 
ON fabrica_limites_preco_tabela 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert price limits" 
ON fabrica_limites_preco_tabela 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update price limits" 
ON fabrica_limites_preco_tabela 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete price limits" 
ON fabrica_limites_preco_tabela 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Migrate existing product-level limits to E-commerce table only (tabela_id for E-commerce)
-- First, find the E-commerce table ID
DO $$
DECLARE
  ecommerce_table_id UUID;
BEGIN
  SELECT id INTO ecommerce_table_id 
  FROM fabrica_tabelas_preco 
  WHERE codigo = '05' OR nome ILIKE '%e-commerce%'
  LIMIT 1;
  
  IF ecommerce_table_id IS NOT NULL THEN
    -- Insert existing limits into the new table-specific limits table for E-commerce only
    INSERT INTO fabrica_limites_preco_tabela (tabela_id, produto_id, preco_maximo, preco_minimo, created_by)
    SELECT 
      ecommerce_table_id,
      id,
      preco_maximo,
      preco_minimo,
      NULL
    FROM fabrica_produtos
    WHERE preco_maximo IS NOT NULL OR preco_minimo IS NOT NULL;
  END IF;
END $$;

-- Clear the global limits from fabrica_produtos since they should only apply to E-commerce
-- (keeping the columns for backward compatibility but clearing the values)
UPDATE fabrica_produtos 
SET preco_maximo = NULL, preco_minimo = NULL 
WHERE preco_maximo IS NOT NULL OR preco_minimo IS NOT NULL;

-- Add comment explaining the change
COMMENT ON TABLE fabrica_limites_preco_tabela IS 'Table-specific price limits. Limits set here apply only to the specified price table, not globally.';
