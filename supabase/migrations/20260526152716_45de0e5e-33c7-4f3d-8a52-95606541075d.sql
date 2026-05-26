CREATE OR REPLACE FUNCTION public.log_fabrica_foto_storage_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'storage'
AS $function$
DECLARE
  v_produto_id uuid;
  v_first_folder text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.bucket_id <> 'fabrica-produto-fotos' THEN RETURN OLD; END IF;
    v_first_folder := (storage.foldername(OLD.name))[1];
  ELSE
    IF NEW.bucket_id <> 'fabrica-produto-fotos' THEN RETURN NEW; END IF;
    v_first_folder := (storage.foldername(NEW.name))[1];
  END IF;

  BEGIN
    v_produto_id := v_first_folder::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_produto_id := NULL;
  END;

  IF v_produto_id IS NOT NULL THEN
    INSERT INTO public.fabrica_produtos_historico
      (produto_id, acao, campos_alterados, dados_anteriores, dados_novos, usuario_id)
    VALUES (
      v_produto_id,
      CASE TG_OP
        WHEN 'INSERT' THEN 'foto_upload'
        WHEN 'UPDATE' THEN 'foto_update'
        WHEN 'DELETE' THEN 'foto_delete'
      END,
      to_jsonb(ARRAY['foto']),
      CASE WHEN TG_OP <> 'INSERT' THEN jsonb_build_object('path', OLD.name) ELSE NULL END,
      CASE WHEN TG_OP <> 'DELETE' THEN jsonb_build_object('path', NEW.name) ELSE NULL END,
      auth.uid()
    );
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;