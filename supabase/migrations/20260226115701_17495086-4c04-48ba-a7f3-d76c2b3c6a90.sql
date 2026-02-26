
-- Add contestation support to requisitos
ALTER TABLE public.fabrica_revisao_requisitos 
ADD COLUMN IF NOT EXISTS contestado boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS contestacao_motivo text,
ADD COLUMN IF NOT EXISTS contestado_por uuid,
ADD COLUMN IF NOT EXISTS contestado_em timestamptz;

-- Add acknowledgment term support to revisões
ALTER TABLE public.fabrica_ficha_custo_revisoes
ADD COLUMN IF NOT EXISTS termo_ciencia_assinado boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS termo_ciencia_texto text,
ADD COLUMN IF NOT EXISTS termo_ciencia_assinado_por uuid,
ADD COLUMN IF NOT EXISTS termo_ciencia_assinado_em timestamptz,
ADD COLUMN IF NOT EXISTS requisitos_pendentes_ao_submeter jsonb;

-- Add resolved manually support
ALTER TABLE public.fabrica_revisao_requisitos
ADD COLUMN IF NOT EXISTS resolvido_manualmente boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS resolucao_descricao text,
ADD COLUMN IF NOT EXISTS resolvido_por uuid,
ADD COLUMN IF NOT EXISTS resolvido_em timestamptz;
