-- 1. Colunas em briefing_documentos
ALTER TABLE public.briefing_documentos
  ADD COLUMN IF NOT EXISTS google_drive_file_id text,
  ADD COLUMN IF NOT EXISTS google_drive_url text,
  ADD COLUMN IF NOT EXISTS google_drive_folder_id text,
  ADD COLUMN IF NOT EXISTS enviado_drive_em timestamptz,
  ADD COLUMN IF NOT EXISTS drive_sync_status text NOT NULL DEFAULT 'desabilitado',
  ADD COLUMN IF NOT EXISTS drive_sync_error text;

-- Validação de status (trigger, não CHECK)
CREATE OR REPLACE FUNCTION public.tg_briefing_doc_validate_drive_status()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.drive_sync_status NOT IN ('desabilitado','pendente','enviado','erro') THEN
    RAISE EXCEPTION 'drive_sync_status inválido: %', NEW.drive_sync_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_briefing_doc_validate_drive_status ON public.briefing_documentos;
CREATE TRIGGER trg_briefing_doc_validate_drive_status
  BEFORE INSERT OR UPDATE ON public.briefing_documentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_briefing_doc_validate_drive_status();

-- 2. Colunas em briefings
ALTER TABLE public.briefings
  ADD COLUMN IF NOT EXISTS google_drive_folder_id text,
  ADD COLUMN IF NOT EXISTS google_drive_folder_url text,
  ADD COLUMN IF NOT EXISTS google_drive_share_url text;

-- 3. Tabela de configuração (singleton)
CREATE TABLE IF NOT EXISTS public.google_drive_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_folder_id text,
  root_folder_name text NOT NULL DEFAULT 'Bimaster — Briefings',
  shared_drive_id text,
  auto_sync_enabled boolean NOT NULL DEFAULT false,
  connection_status text NOT NULL DEFAULT 'nao_configurado',
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

-- Validação connection_status
CREATE OR REPLACE FUNCTION public.tg_gdrive_config_validate_status()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.connection_status NOT IN ('nao_configurado','conectado','erro','desconectado') THEN
    RAISE EXCEPTION 'connection_status inválido: %', NEW.connection_status;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gdrive_config_validate_status ON public.google_drive_config;
CREATE TRIGGER trg_gdrive_config_validate_status
  BEFORE INSERT OR UPDATE ON public.google_drive_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_gdrive_config_validate_status();

ALTER TABLE public.google_drive_config ENABLE ROW LEVEL SECURITY;

-- Política: qualquer autenticado pode ler (UI precisa saber se está conectado)
DROP POLICY IF EXISTS "gdrive_config_select_authenticated"
  ON public.google_drive_config;
CREATE POLICY "gdrive_config_select_authenticated"
  ON public.google_drive_config
  FOR SELECT
  TO authenticated
  USING (true);

-- Política: apenas admin pode inserir/editar/deletar
DROP POLICY IF EXISTS "gdrive_config_admin_write"
  ON public.google_drive_config;
CREATE POLICY "gdrive_config_admin_write"
  ON public.google_drive_config
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed de uma linha vazia se não existir
INSERT INTO public.google_drive_config (root_folder_name, auto_sync_enabled, connection_status)
SELECT 'Bimaster — Briefings', false, 'nao_configurado'
WHERE NOT EXISTS (SELECT 1 FROM public.google_drive_config);

-- 4. Tabela de log de sync
CREATE TABLE IF NOT EXISTS public.google_drive_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid,
  briefing_id uuid,
  acao text NOT NULL,
  status text NOT NULL,
  drive_file_id text,
  drive_folder_id text,
  error_message text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX IF NOT EXISTS idx_gdrive_log_briefing ON public.google_drive_sync_log(briefing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gdrive_log_status ON public.google_drive_sync_log(status, created_at DESC);

ALTER TABLE public.google_drive_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gdrive_log_select_admin" ON public.google_drive_sync_log;
CREATE POLICY "gdrive_log_select_admin"
  ON public.google_drive_sync_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
