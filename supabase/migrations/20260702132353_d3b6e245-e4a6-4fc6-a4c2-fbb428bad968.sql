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
  v_code text;
  v_reason text;
BEGIN
  IF NEW.bucket_id <> 'projeto-anexos' THEN
    RETURN NEW;
  END IF;

  v_size := COALESCE((NEW.metadata->>'size')::bigint, 0);
  v_mime := lower(COALESCE(NEW.metadata->>'mimetype', ''));
  v_ext  := lower(COALESCE(regexp_replace(NEW.name, '^.*\.', ''), ''));
  v_is_video  := v_mime LIKE 'video/%' OR v_ext IN ('mp4','mov','webm','m4v','qt');

  -- Teto unificado: 1 GB (1073741824 bytes) para qualquer extensão suportada.
  IF v_size > 1073741824 THEN
    v_code := 'size_exceeded';
    v_reason := format('Arquivo tem %s bytes e excede o limite máximo de 1 GB por arquivo', v_size);
  END IF;

  IF v_code IS NOT NULL THEN
    BEGIN
      INSERT INTO public.projeto_anexos_upload_audit
        (bucket_id, object_name, owner_id, file_size, mime_type, extension,
         is_video, rejection_code, rejection_reason, raw_metadata)
      VALUES
        (NEW.bucket_id, NEW.name, NEW.owner, v_size, v_mime, v_ext,
         v_is_video, v_code, v_reason, NEW.metadata);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    RAISE EXCEPTION '%', v_reason USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;