-- Adicionar campos de dados da Receita Federal na tabela stores
ALTER TABLE public.stores 
  ADD COLUMN IF NOT EXISTS situacao_cadastral VARCHAR(50),
  ADD COLUMN IF NOT EXISTS porte_empresa VARCHAR(100),
  ADD COLUMN IF NOT EXISTS regime_tributario VARCHAR(100),
  ADD COLUMN IF NOT EXISTS matriz_filial VARCHAR(20),
  ADD COLUMN IF NOT EXISTS capital_social VARCHAR(50),
  ADD COLUMN IF NOT EXISTS cnae_principal TEXT;