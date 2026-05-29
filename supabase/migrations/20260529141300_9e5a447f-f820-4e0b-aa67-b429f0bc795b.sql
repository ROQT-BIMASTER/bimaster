-- =============================================================
-- Expansão da auditoria de ações de administradores em permissões
-- =============================================================

-- 1) Função genérica de log para tabelas de permissão
CREATE OR REPLACE FUNCTION public.log_permission_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_entity_id uuid;
  v_target_user uuid;
  v_role text;
  v_dept uuid;
  v_modulo_codigo text;
  v_tela_codigo text;
  v_rec jsonb;
BEGIN
  v_rec := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;

  -- usuario alvo (quando aplicável)
  IF v_rec ? 'usuario_id' THEN
    v_target_user := (v_rec->>'usuario_id')::uuid;
  END IF;

  -- role (quando aplicável)
  IF v_rec ? 'role' THEN
    v_role := v_rec->>'role';
  END IF;

  -- departamento (quando aplicável)
  IF v_rec ? 'departamento_id' THEN
    v_dept := (v_rec->>'departamento_id')::uuid;
  END IF;

  -- codinome do modulo (lookup leve)
  IF v_rec ? 'modulo_id' THEN
    SELECT codigo INTO v_modulo_codigo
    FROM public.modulos_sistema
    WHERE id = (v_rec->>'modulo_id')::uuid;
  END IF;

  -- codinome da tela (lookup leve)
  IF v_rec ? 'tela_id' THEN
    SELECT codigo INTO v_tela_codigo
    FROM public.telas_sistema
    WHERE id = (v_rec->>'tela_id')::uuid;
  END IF;

  -- ui_permissions já guarda tela_codigo/componente_codigo direto
  IF v_rec ? 'tela_codigo' AND v_tela_codigo IS NULL THEN
    v_tela_codigo := v_rec->>'tela_codigo';
  END IF;

  -- entity_id: prioriza usuario, depois id da linha
  v_entity_id := COALESCE(v_target_user, (v_rec->>'id')::uuid);

  INSERT INTO public.audit_logs (
    user_id, action, entity_type, entity_id, old_data, new_data, metadata
  ) VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    v_entity_id,
    CASE WHEN TG_OP IN ('DELETE','UPDATE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    jsonb_strip_nulls(jsonb_build_object(
      'source', 'db_trigger',
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'target_user_id', v_target_user,
      'role', v_role,
      'departamento_id', v_dept,
      'modulo_codigo', v_modulo_codigo,
      'tela_codigo', v_tela_codigo,
      'componente_codigo', v_rec->>'componente_codigo'
    ))
  );

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 2) Triggers nas tabelas de permissão ainda sem cobertura
DROP TRIGGER IF EXISTS audit_role_permissoes_modulos ON public.role_permissoes_modulos;
CREATE TRIGGER audit_role_permissoes_modulos
AFTER INSERT OR UPDATE OR DELETE ON public.role_permissoes_modulos
FOR EACH ROW EXECUTE FUNCTION public.log_permission_changes();

DROP TRIGGER IF EXISTS audit_role_permissoes_telas ON public.role_permissoes_telas;
CREATE TRIGGER audit_role_permissoes_telas
AFTER INSERT OR UPDATE OR DELETE ON public.role_permissoes_telas
FOR EACH ROW EXECUTE FUNCTION public.log_permission_changes();

DROP TRIGGER IF EXISTS audit_departamento_permissoes_modulos ON public.departamento_permissoes_modulos;
CREATE TRIGGER audit_departamento_permissoes_modulos
AFTER INSERT OR UPDATE OR DELETE ON public.departamento_permissoes_modulos
FOR EACH ROW EXECUTE FUNCTION public.log_permission_changes();

DROP TRIGGER IF EXISTS audit_departamento_permissoes_telas ON public.departamento_permissoes_telas;
CREATE TRIGGER audit_departamento_permissoes_telas
AFTER INSERT OR UPDATE OR DELETE ON public.departamento_permissoes_telas
FOR EACH ROW EXECUTE FUNCTION public.log_permission_changes();

DROP TRIGGER IF EXISTS audit_ui_permissions ON public.ui_permissions;
CREATE TRIGGER audit_ui_permissions
AFTER INSERT OR UPDATE OR DELETE ON public.ui_permissions
FOR EACH ROW EXECUTE FUNCTION public.log_permission_changes();

-- 3) Auditoria de mudanças administrativas em profiles
CREATE OR REPLACE FUNCTION public.audit_profiles_admin_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changed_fields text[] := ARRAY[]::text[];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.aprovado IS DISTINCT FROM OLD.aprovado THEN v_changed_fields := v_changed_fields || 'aprovado'; END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN v_changed_fields := v_changed_fields || 'status'; END IF;
    IF NEW.departamento_id IS DISTINCT FROM OLD.departamento_id THEN v_changed_fields := v_changed_fields || 'departamento_id'; END IF;
    IF NEW.supervisor_id IS DISTINCT FROM OLD.supervisor_id THEN v_changed_fields := v_changed_fields || 'supervisor_id'; END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN v_changed_fields := v_changed_fields || 'email'; END IF;

    IF array_length(v_changed_fields, 1) IS NULL THEN
      RETURN NEW; -- nenhuma mudança sensível
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
$$;

DROP TRIGGER IF EXISTS trg_audit_profiles_admin_changes ON public.profiles;
CREATE TRIGGER trg_audit_profiles_admin_changes
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_profiles_admin_changes();

-- 4) RPC consolidada admin-only
CREATE OR REPLACE FUNCTION public.rpc_admin_security_audit(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_target_user_id uuid DEFAULT NULL,
  p_entity_types text[] DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
) RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  actor_id uuid,
  actor_nome text,
  actor_email text,
  entity_type text,
  action text,
  target_user_id uuid,
  target_user_nome text,
  target_role text,
  target_departamento text,
  modulo_codigo text,
  tela_codigo text,
  componente_codigo text,
  acao_descricao text,
  old_data jsonb,
  new_data jsonb,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_pattern text;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_pattern := CASE
    WHEN p_search IS NULL OR length(trim(p_search)) = 0 THEN NULL
    ELSE '%' || lower(trim(p_search)) || '%'
  END;

  WITH base AS (
    SELECT
      al.*,
      (al.metadata->>'target_user_id')::uuid AS m_target_user,
      al.metadata->>'role' AS m_role,
      (al.metadata->>'departamento_id')::uuid AS m_dept,
      al.metadata->>'modulo_codigo' AS m_modulo,
      al.metadata->>'tela_codigo' AS m_tela,
      al.metadata->>'componente_codigo' AS m_componente,
      al.metadata->>'target_email' AS m_target_email,
      al.metadata->>'target_nome' AS m_target_nome
    FROM public.audit_logs al
    WHERE al.entity_type IN (
      'usuario_permissoes_modulos','usuario_permissoes_telas',
      'role_permissoes_modulos','role_permissoes_telas',
      'departamento_permissoes_modulos','departamento_permissoes_telas',
      'ui_permissions','user_roles','profiles'
    )
      AND (p_from IS NULL OR al.created_at >= p_from)
      AND (p_to IS NULL OR al.created_at <= p_to)
      AND (p_actor_id IS NULL OR al.user_id = p_actor_id)
      AND (p_entity_types IS NULL OR al.entity_type = ANY (p_entity_types))
      AND (p_action IS NULL OR al.action = p_action)
  ),
  filtered AS (
    SELECT b.*
    FROM base b
    WHERE
      (p_target_user_id IS NULL
        OR b.entity_id = p_target_user_id
        OR b.m_target_user = p_target_user_id)
      AND (v_pattern IS NULL
        OR lower(coalesce(b.m_modulo,'')) LIKE v_pattern
        OR lower(coalesce(b.m_tela,'')) LIKE v_pattern
        OR lower(coalesce(b.m_componente,'')) LIKE v_pattern
        OR lower(coalesce(b.m_role,'')) LIKE v_pattern
        OR lower(coalesce(b.m_target_email,'')) LIKE v_pattern
        OR lower(coalesce(b.m_target_nome,'')) LIKE v_pattern
      )
  )
  SELECT count(*) INTO v_total FROM filtered;

  RETURN QUERY
  WITH base AS (
    SELECT
      al.*,
      (al.metadata->>'target_user_id')::uuid AS m_target_user,
      al.metadata->>'role' AS m_role,
      (al.metadata->>'departamento_id')::uuid AS m_dept,
      al.metadata->>'modulo_codigo' AS m_modulo,
      al.metadata->>'tela_codigo' AS m_tela,
      al.metadata->>'componente_codigo' AS m_componente,
      al.metadata->>'target_email' AS m_target_email,
      al.metadata->>'target_nome' AS m_target_nome,
      al.metadata->>'changed_fields' AS m_changed_fields
    FROM public.audit_logs al
    WHERE al.entity_type IN (
      'usuario_permissoes_modulos','usuario_permissoes_telas',
      'role_permissoes_modulos','role_permissoes_telas',
      'departamento_permissoes_modulos','departamento_permissoes_telas',
      'ui_permissions','user_roles','profiles'
    )
      AND (p_from IS NULL OR al.created_at >= p_from)
      AND (p_to IS NULL OR al.created_at <= p_to)
      AND (p_actor_id IS NULL OR al.user_id = p_actor_id)
      AND (p_entity_types IS NULL OR al.entity_type = ANY (p_entity_types))
      AND (p_action IS NULL OR al.action = p_action)
  ),
  filtered AS (
    SELECT b.*
    FROM base b
    WHERE
      (p_target_user_id IS NULL
        OR b.entity_id = p_target_user_id
        OR b.m_target_user = p_target_user_id)
      AND (v_pattern IS NULL
        OR lower(coalesce(b.m_modulo,'')) LIKE v_pattern
        OR lower(coalesce(b.m_tela,'')) LIKE v_pattern
        OR lower(coalesce(b.m_componente,'')) LIKE v_pattern
        OR lower(coalesce(b.m_role,'')) LIKE v_pattern
        OR lower(coalesce(b.m_target_email,'')) LIKE v_pattern
        OR lower(coalesce(b.m_target_nome,'')) LIKE v_pattern
      )
  )
  SELECT
    f.id,
    f.created_at,
    f.user_id AS actor_id,
    actor.nome AS actor_nome,
    actor.email AS actor_email,
    f.entity_type,
    f.action,
    COALESCE(f.m_target_user, f.entity_id) AS target_user_id,
    tgt.nome AS target_user_nome,
    f.m_role AS target_role,
    dept.nome AS target_departamento,
    f.m_modulo AS modulo_codigo,
    f.m_tela AS tela_codigo,
    f.m_componente AS componente_codigo,
    -- Descrição amigável
    (CASE f.entity_type
      WHEN 'usuario_permissoes_modulos' THEN
        (CASE f.action
          WHEN 'INSERT' THEN 'Concedeu acesso ao módulo'
          WHEN 'DELETE' THEN 'Revogou acesso ao módulo'
          ELSE 'Alterou permissão de módulo'
         END) || coalesce(' "' || f.m_modulo || '"','')
          || coalesce(' para ' || tgt.nome,'')
      WHEN 'usuario_permissoes_telas' THEN
        (CASE f.action
          WHEN 'INSERT' THEN 'Concedeu acesso à tela'
          WHEN 'DELETE' THEN 'Revogou acesso à tela'
          ELSE 'Alterou permissão de tela'
         END) || coalesce(' "' || f.m_tela || '"','')
          || coalesce(' para ' || tgt.nome,'')
      WHEN 'role_permissoes_modulos' THEN
        (CASE f.action WHEN 'INSERT' THEN 'Concedeu módulo' WHEN 'DELETE' THEN 'Revogou módulo' ELSE 'Alterou módulo' END)
          || coalesce(' "' || f.m_modulo || '"','')
          || coalesce(' para o papel "' || f.m_role || '"','')
      WHEN 'role_permissoes_telas' THEN
        (CASE f.action WHEN 'INSERT' THEN 'Concedeu tela' WHEN 'DELETE' THEN 'Revogou tela' ELSE 'Alterou tela' END)
          || coalesce(' "' || f.m_tela || '"','')
          || coalesce(' para o papel "' || f.m_role || '"','')
      WHEN 'departamento_permissoes_modulos' THEN
        (CASE f.action WHEN 'INSERT' THEN 'Concedeu módulo' WHEN 'DELETE' THEN 'Revogou módulo' ELSE 'Alterou módulo' END)
          || coalesce(' "' || f.m_modulo || '"','')
          || coalesce(' para o departamento "' || dept.nome || '"','')
      WHEN 'departamento_permissoes_telas' THEN
        (CASE f.action WHEN 'INSERT' THEN 'Concedeu tela' WHEN 'DELETE' THEN 'Revogou tela' ELSE 'Alterou tela' END)
          || coalesce(' "' || f.m_tela || '"','')
          || coalesce(' para o departamento "' || dept.nome || '"','')
      WHEN 'ui_permissions' THEN
        (CASE f.action WHEN 'INSERT' THEN 'Criou regra UI' WHEN 'DELETE' THEN 'Removeu regra UI' ELSE 'Alterou regra UI' END)
          || coalesce(' em "' || f.m_tela || '"','')
          || coalesce(' / componente "' || f.m_componente || '"','')
      WHEN 'user_roles' THEN
        (CASE f.action WHEN 'INSERT' THEN 'Concedeu papel' WHEN 'DELETE' THEN 'Removeu papel' ELSE 'Alterou papel' END)
          || coalesce(' "' || coalesce(f.new_data->>'role', f.old_data->>'role') || '"','')
          || coalesce(' para ' || tgt.nome,'')
      WHEN 'profiles' THEN
        (CASE f.action
          WHEN 'INSERT' THEN 'Criou usuário'
          WHEN 'DELETE' THEN 'Excluiu usuário'
          ELSE 'Atualizou cadastro' || coalesce(' (' || f.m_changed_fields || ')','')
        END)
          || coalesce(' ' || coalesce(tgt.nome, f.m_target_nome, f.m_target_email),'')
      ELSE f.entity_type || ' / ' || f.action
    END) AS acao_descricao,
    f.old_data,
    f.new_data,
    v_total AS total_count
  FROM filtered f
  LEFT JOIN public.profiles actor ON actor.id = f.user_id
  LEFT JOIN public.profiles tgt   ON tgt.id   = COALESCE(f.m_target_user, f.entity_id)
  LEFT JOIN public.departamentos dept ON dept.id = f.m_dept
  ORDER BY f.created_at DESC
  LIMIT GREATEST(p_limit, 1)
  OFFSET GREATEST(p_offset, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_admin_security_audit(timestamptz, timestamptz, uuid, uuid, text[], text, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_admin_security_audit(timestamptz, timestamptz, uuid, uuid, text[], text, text, int, int) TO authenticated;

-- 5) RPC auxiliar para popular dropdowns (admins e usuários alvo)
CREATE OR REPLACE FUNCTION public.rpc_admin_security_audit_actors()
RETURNS TABLE (id uuid, nome text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.nome, p.email
  FROM public.profiles p
  WHERE EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.id AND ur.role = 'admin'
  )
  AND has_role(auth.uid(), 'admin'::app_role)
  ORDER BY p.nome;
$$;

REVOKE ALL ON FUNCTION public.rpc_admin_security_audit_actors() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_admin_security_audit_actors() TO authenticated;