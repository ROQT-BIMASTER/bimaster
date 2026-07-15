CREATE OR REPLACE FUNCTION public.log_permission_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_email text;
  v_target uuid;
  v_recurso_id uuid;
  v_recurso_codigo text;
  v_recurso_nome text;
  v_row jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN v_row := to_jsonb(OLD); ELSE v_row := to_jsonb(NEW); END IF;

  v_target := COALESCE((v_row->>'user_id')::uuid, (v_row->>'usuario_id')::uuid);

  IF v_row ? 'modulo_id' THEN
    v_recurso_id := (v_row->>'modulo_id')::uuid;
    SELECT codigo, nome INTO v_recurso_codigo, v_recurso_nome
      FROM public.modulos_sistema WHERE id = v_recurso_id;
  ELSIF v_row ? 'tela_id' THEN
    v_recurso_id := (v_row->>'tela_id')::uuid;
    SELECT codigo, nome INTO v_recurso_codigo, v_recurso_nome
      FROM public.telas_sistema WHERE id = v_recurso_id;
  ELSIF v_row ? 'departamento_id' THEN
    v_recurso_id := (v_row->>'departamento_id')::uuid;
    SELECT NULL::text, nome INTO v_recurso_codigo, v_recurso_nome
      FROM public.departamentos WHERE id = v_recurso_id;
  ELSIF v_row ? 'role' THEN
    v_recurso_codigo := v_row->>'role';
    v_recurso_nome := v_row->>'role';
  END IF;

  IF v_actor IS NOT NULL THEN
    SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  END IF;

  INSERT INTO public.permissoes_auditoria(
    tabela, acao, usuario_alvo, recurso_id, recurso_codigo, recurso_nome,
    alterado_por, alterado_por_email
  ) VALUES (
    TG_TABLE_NAME, TG_OP, v_target, v_recurso_id, v_recurso_codigo, v_recurso_nome,
    v_actor, v_actor_email
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_session_invalidation_on_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_reason text;
BEGIN
  IF TG_OP = 'DELETE' THEN v_user := OLD.user_id; ELSE v_user := NEW.user_id; END IF;
  IF v_user IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  IF TG_TABLE_NAME = 'user_roles' AND TG_OP = 'UPDATE'
     AND OLD.role IS NOT DISTINCT FROM NEW.role THEN
    RETURN NEW;
  END IF;

  v_reason := CASE
    WHEN TG_TABLE_NAME = 'user_roles' THEN 'role_change'
    WHEN TG_TABLE_NAME = 'admin_escopo_limitado' THEN 'scope_change'
    ELSE 'permission_change'
  END;

  INSERT INTO public.session_invalidation_queue(user_id, reason)
  VALUES (v_user, v_reason);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'user_roles','usuario_permissoes_modulos','usuario_permissoes_telas',
    'usuario_modulos_negados','departamento_permissoes_modulos','departamento_permissoes_telas',
    'role_permissoes_modulos','role_permissoes_telas','admin_escopo_limitado'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_permission ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_permission
         AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.log_permission_change()', t);
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_invalidate_session_on_role ON public.user_roles;
CREATE TRIGGER trg_invalidate_session_on_role
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_session_invalidation_on_role();

DROP TRIGGER IF EXISTS trg_invalidate_session_on_scope ON public.admin_escopo_limitado;
CREATE TRIGGER trg_invalidate_session_on_scope
  AFTER INSERT OR UPDATE OR DELETE ON public.admin_escopo_limitado
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_session_invalidation_on_role();

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'user_roles','usuario_modulos_negados','departamento_permissoes_modulos',
    'departamento_permissoes_telas','role_permissoes_modulos','role_permissoes_telas',
    'admin_escopo_limitado'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;