
CREATE OR REPLACE FUNCTION public.fn_fabrica_produtos_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed jsonb := '{}'::jsonb;
  old_json jsonb;
  new_json jsonb;
  key text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.fabrica_produtos_historico (produto_id, acao, dados_novos, usuario_id)
    VALUES (NEW.id, 'INSERT', to_jsonb(NEW), NEW.created_by);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);

    FOR key IN SELECT jsonb_object_keys(new_json)
    LOOP
      IF key NOT IN ('updated_at', 'updated_by', 'created_at', 'created_by') AND (old_json ->> key IS DISTINCT FROM new_json ->> key) THEN
        changed := changed || jsonb_build_object(key, jsonb_build_object('antes', old_json -> key, 'depois', new_json -> key));
      END IF;
    END LOOP;

    IF changed != '{}'::jsonb THEN
      INSERT INTO public.fabrica_produtos_historico (produto_id, acao, campos_alterados, dados_anteriores, dados_novos, usuario_id)
      VALUES (NEW.id, 'UPDATE', changed, old_json, new_json, NEW.updated_by);
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;
