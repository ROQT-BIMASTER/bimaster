-- Adicionar campos de detalhamento na tabela de revisão
ALTER TABLE public.contas_pagar_revisao
ADD COLUMN IF NOT EXISTS fornecedor_nome TEXT,
ADD COLUMN IF NOT EXISTS fornecedor_codigo TEXT,
ADD COLUMN IF NOT EXISTS numero_documento TEXT,
ADD COLUMN IF NOT EXISTS data_vencimento DATE,
ADD COLUMN IF NOT EXISTS empresa_nome TEXT,
ADD COLUMN IF NOT EXISTS tipo_documento TEXT;