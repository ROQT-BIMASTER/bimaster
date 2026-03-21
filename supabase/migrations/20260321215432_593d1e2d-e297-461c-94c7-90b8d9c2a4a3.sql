ALTER TABLE public.departamentos 
  ADD COLUMN IF NOT EXISTS codigo_omie varchar(40) UNIQUE,
  ADD COLUMN IF NOT EXISTS estrutura varchar(40),
  ADD COLUMN IF NOT EXISTS nivel_totalizador varchar(1) DEFAULT 'N';