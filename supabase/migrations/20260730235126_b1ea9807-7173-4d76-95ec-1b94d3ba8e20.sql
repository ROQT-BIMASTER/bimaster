CREATE TABLE IF NOT EXISTS public.anexos_download_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  projeto_id uuid,
  origem text NOT NULL DEFAULT 'kanban',
  total_arquivos integer NOT NULL DEFAULT 0,
  total_falhas integer NOT NULL DEFAULT 0,
  tamanho_bytes bigint NOT NULL DEFAULT 0,
  pacote_nome text,
  arquivos jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anexos_download_log_user ON public.anexos_download_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anexos_download_log_projeto ON public.anexos_download_log (projeto_id, created_at DESC);

GRANT SELECT, INSERT ON public.anexos_download_log TO authenticated;
GRANT ALL ON public.anexos_download_log TO service_role;

ALTER TABLE public.anexos_download_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anexos_download_log_insert_own"
ON public.anexos_download_log FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "anexos_download_log_select_own_or_admin"
ON public.anexos_download_log FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));