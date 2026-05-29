
CREATE OR REPLACE FUNCTION public.audit_profiles_admin_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_changed_fields text[] := ARRAY[]::text[];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.aprovado IS DISTINCT FROM OLD.aprovado THEN v_changed_fields := array_append(v_changed_fields, 'aprovado'); END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN v_changed_fields := array_append(v_changed_fields, 'status'); END IF;
    IF NEW.departamento_id IS DISTINCT FROM OLD.departamento_id THEN v_changed_fields := array_append(v_changed_fields, 'departamento_id'); END IF;
    IF NEW.supervisor_id IS DISTINCT FROM OLD.supervisor_id THEN v_changed_fields := array_append(v_changed_fields, 'supervisor_id'); END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN v_changed_fields := array_append(v_changed_fields, 'email'); END IF;

    IF array_length(v_changed_fields, 1) IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.audit_logs (
    user_id, action, entity_type, entity_id, old_data, new_data, metadata
  ) VALUES (
    auth.uid(),
    TG_OP,
    'profiles',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    jsonb_strip_nulls(jsonb_build_object(
      'source', 'db_trigger',
      'table', 'profiles',
      'operation', TG_OP,
      'target_user_id', COALESCE(NEW.id, OLD.id),
      'changed_fields', CASE WHEN array_length(v_changed_fields,1) IS NULL THEN NULL ELSE to_jsonb(v_changed_fields) END,
      'target_email', COALESCE(NEW.email, OLD.email),
      'target_nome', COALESCE(NEW.nome, OLD.nome)
    ))
  );

  RETURN COALESCE(NEW, OLD);
END;
$function$;

UPDATE public.profiles
SET aprovado = true, status = 'ativo', updated_at = now()
WHERE email = 'suporte_t.i@distribuidoraunion.com.br';
