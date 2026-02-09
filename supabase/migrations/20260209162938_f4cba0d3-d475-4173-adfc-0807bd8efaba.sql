
-- Add granular access columns
ALTER TABLE public.user_price_table_access
  ADD COLUMN linha text DEFAULT NULL,
  ADD COLUMN produto_id uuid DEFAULT NULL REFERENCES public.fabrica_produtos(id) ON DELETE CASCADE;

-- Drop old unique constraint
ALTER TABLE public.user_price_table_access
  DROP CONSTRAINT user_price_table_access_user_id_tabela_id_key;

-- Create new unique constraint using COALESCE to handle NULLs
CREATE UNIQUE INDEX user_price_table_access_granular_uq 
  ON public.user_price_table_access (user_id, tabela_id, COALESCE(linha, ''), COALESCE(produto_id, '00000000-0000-0000-0000-000000000000'));

-- Update RLS policies remain unchanged since they already filter by user_id
