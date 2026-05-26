CREATE OR REPLACE FUNCTION public.tg_briefing_doc_validate_drive_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.drive_sync_status NOT IN ('desabilitado','pendente','enviado','erro') THEN
    RAISE EXCEPTION 'drive_sync_status inválido: %', NEW.drive_sync_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_gdrive_config_validate_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.connection_status NOT IN ('nao_configurado','conectado','erro','desconectado') THEN
    RAISE EXCEPTION 'connection_status inválido: %', NEW.connection_status;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;