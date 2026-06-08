-- Soft remove no Cofre (fabrica_revisao_documentos)
ALTER TABLE public.fabrica_revisao_documentos
  ADD COLUMN IF NOT EXISTS removed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS removed_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fabrica_revisao_documentos_status_removed
  ON public.fabrica_revisao_documentos (status, removed_at)
  WHERE removed_at IS NULL;

-- Função utilitária: "agora" no fuso Brasil para triggers/views futuros.
CREATE OR REPLACE FUNCTION public.app_now_br()
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'
$$;