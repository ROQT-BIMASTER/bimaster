-- Fase 1/3 (complemento): atrio_situacao e atrio_sincronizado_em
-- atrio_situacao: guarda o status retornado pela API ("ABERTO","BAIXADO","CANCELADO",etc.)
--   → necessário para estratégia de corte histórico: registros históricos já no Supabase
--     têm situacao inferida localmente; após a migração, novos syncs gravam o status real da API.
-- atrio_sincronizado_em: timestamp da última sincronização bem-sucedida via API Atrio.
--   → permite detectar registros "órfãos" (syncs antigos não atualizados) e
--     serve de cutoff para não re-sincronizar desnecessariamente.

ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS atrio_situacao       VARCHAR(50),
  ADD COLUMN IF NOT EXISTS atrio_sincronizado_em TIMESTAMPTZ;

ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS atrio_sincronizado_em TIMESTAMPTZ;

-- Índice para queries de cutoff: "quais registros foram atualizados pela API desde X?"
CREATE INDEX IF NOT EXISTS idx_cp_atrio_sincronizado_em
  ON public.contas_pagar (atrio_sincronizado_em)
  WHERE atrio_sincronizado_em IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cr_atrio_sincronizado_em
  ON public.contas_receber (atrio_sincronizado_em)
  WHERE atrio_sincronizado_em IS NOT NULL;
