
CREATE OR REPLACE FUNCTION public.enforce_projeto_anexos_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_size bigint;
  v_mime text;
  v_ext text;
  v_is_video boolean;
BEGIN
  IF NEW.bucket_id <> 'projeto-anexos' THEN
    RETURN NEW;
  END IF;

  v_size := COALESCE((NEW.metadata->>'size')::bigint, 0);
  v_mime := lower(COALESCE(NEW.metadata->>'mimetype', ''));
  v_ext  := lower(COALESCE(regexp_replace(NEW.name, '^.*\.', ''), ''));

  v_is_video := v_mime LIKE 'video/%' OR v_ext IN ('mp4','mov','webm','m4v','qt');

  IF v_is_video THEN
    IF v_size > 104857600 THEN
      RAISE EXCEPTION 'Arquivo de vídeo excede o limite de 100 MB'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    IF v_size > 20971520 THEN
      RAISE EXCEPTION 'Arquivo excede o limite de 20 MB para este tipo'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_projeto_anexos_limits ON storage.objects;
CREATE TRIGGER trg_enforce_projeto_anexos_limits
  BEFORE INSERT OR UPDATE ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_projeto_anexos_limits();
