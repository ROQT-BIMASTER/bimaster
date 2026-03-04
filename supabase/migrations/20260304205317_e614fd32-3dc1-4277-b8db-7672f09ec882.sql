ALTER TABLE public.fabrica_produto_visibility_blocks 
  ADD COLUMN launch_date DATE NULL,
  ADD COLUMN tabela_id UUID NULL REFERENCES public.fabrica_tabelas_preco(id) ON DELETE SET NULL;