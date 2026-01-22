-- Adicionar constraint UNIQUE na coluna erp_id para permitir UPSERT com ON CONFLICT
-- Primeiro verificar se existe e remover duplicatas se necessário

-- Criar índice único na coluna erp_id (essencial para upsert funcionar)
CREATE UNIQUE INDEX IF NOT EXISTS contas_receber_erp_id_unique ON public.contas_receber (erp_id);

-- Adicionar constraint unique usando o índice
ALTER TABLE public.contas_receber
ADD CONSTRAINT contas_receber_erp_id_key UNIQUE USING INDEX contas_receber_erp_id_unique;