
ALTER TABLE public.china_produto_documentos
  ADD COLUMN IF NOT EXISTS oficializado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS oficializado_por uuid,
  ADD COLUMN IF NOT EXISTS oficializado_em timestamptz,
  ADD COLUMN IF NOT EXISTS assinado_por uuid,
  ADD COLUMN IF NOT EXISTS assinado_em timestamptz,
  ADD COLUMN IF NOT EXISTS assinatura_nome text;
