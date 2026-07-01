
-- 1. Audit table
CREATE TABLE IF NOT EXISTS public.projeto_anexos_upload_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  bucket_id text NOT NULL,
  object_name text NOT NULL,
  owner_id uuid,
  file_size bigint,
  mime_type text,
  extension text,
  is_video boolean,
  rejection_code text NOT NULL,
  rejection_reason text NOT NULL,
  raw_metadata jsonb
);

GRANT SELECT ON public.projeto_anexos_upload_audit TO authenticated;
GRANT ALL ON public.projeto_anexos_upload_audit TO service_role;

ALTER TABLE public.projeto_anexos_upload_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read upload audit"
  ON public.projeto_anexos_upload_audit
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_projeto_anexos_upload_audit_created_at
  ON public.projeto_anexos_upload_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projeto_anexos_upload_audit_code
  ON public.projeto_anexos_upload_audit (rejection_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projeto_anexos_upload_audit_owner
  ON public.projeto_anexos_upload_audit (owner_id, created_at DESC);

-- 2. Update trigger function to log rejections before raising
CREATE OR REPLACE FUNCTION public.enforce_projeto_anexos_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_is_video := v_mime LIKE 'video/%' OR v_ext IN ('mp4','mov','webm','m4v','qt');

  IF v_is_video AND v_size > 104857600 THEN
    v_code := 'video_size_exceeded';
    v_reason := format('Arquivo de vídeo tem %s bytes e excede o limite de 100 MB', v_size);
  ELSIF NOT v_is_video AND v_size > 20971520 THEN
    v_code := 'document_size_exceeded';
    v_reason := format('Arquivo tem %s bytes e excede o limite de 20 MB para este tipo', v_size);
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
      -- Nunca deixar a auditoria bloquear a validação principal
      NULL;
    END;

    RAISE EXCEPTION '%', v_reason USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;
