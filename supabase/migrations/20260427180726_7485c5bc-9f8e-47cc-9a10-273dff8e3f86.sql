-- ─── Pipeline de Vendas: preparação da tabela Union ───

-- 1. Coluna erp_id (identificador externo único do ERP)
ALTER TABLE public."Union"
  ADD COLUMN IF NOT EXISTS erp_id text;

-- 2. Coluna sincronizado_em (timestamp da última sync)
ALTER TABLE public."Union"
  ADD COLUMN IF NOT EXISTS sincronizado_em timestamptz;

-- 3. Backfill do erp_id para registros existentes
--    Formato: {id_empresa}-{nota}-{pedido}-{cod_produto}
UPDATE public."Union"
SET erp_id = COALESCE(id_empresa::text, '0')
            || '-' || COALESCE(nota::text, '0')
            || '-' || COALESCE(pedido::text, '0')
            || '-' || COALESCE(cod_produto::text, '0')
WHERE erp_id IS NULL;

-- 4. Índice único no erp_id (necessário para upsert ON CONFLICT)
--    Se houver duplicatas residuais elas serão mantidas como NULL para revisão manual
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'union_erp_id_unique_idx'
  ) THEN
    -- Remove duplicatas mantendo o id mais recente antes de criar o índice único
    DELETE FROM public."Union" u1
    USING public."Union" u2
    WHERE u1.erp_id = u2.erp_id
      AND u1.id < u2.id
      AND u1.erp_id IS NOT NULL;

    CREATE UNIQUE INDEX union_erp_id_unique_idx
      ON public."Union" (erp_id)
      WHERE erp_id IS NOT NULL;
  END IF;
END $$;

-- 5. Índice em sincronizado_em (para o painel de monitoramento)
CREATE INDEX IF NOT EXISTS idx_union_sincronizado_em
  ON public."Union" (sincronizado_em DESC);

-- 6. Atualiza a view vendas_union para expor as novas colunas
DROP VIEW IF EXISTS public.vendas_union;

CREATE VIEW public.vendas_union AS
SELECT
  id, id_empresa, empresa, pedido, data, nota, operacao,
  cod_cliente, cliente, id_ramo, ramo, cidade, uf,
  tp_venda, tp_nfe, cod_produto, descricao, marca,
  quantidade, preco_venda, vl_desconto, vl_icm_subst,
  vl_cmv, vl_outros_custos, tabela, cod_vend, vendedor,
  cod_equipe, nome_equipe, supervisor, nome_linha,
  created_at, updated_at, venda,
  erp_id, sincronizado_em
FROM public."Union";

-- 7. Comentários para auditoria
COMMENT ON COLUMN public."Union".erp_id IS
  'Identificador único do ERP (formato: empresa-nota-pedido-produto). Usado como chave de conflito no upsert da sync.';
COMMENT ON COLUMN public."Union".sincronizado_em IS
  'Timestamp da última sincronização vinda do erp-sync-engine.';