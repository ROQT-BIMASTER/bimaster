-- Criar função para log de alterações de permissões via trigger
CREATE OR REPLACE FUNCTION public.log_permission_changes()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id, 
    action, 
    entity_type, 
    entity_id, 
    old_data, 
    new_data, 
    metadata
  ) VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.usuario_id, OLD.usuario_id),
    CASE WHEN TG_OP IN ('DELETE', 'UPDATE') THEN row_to_json(OLD)::jsonb ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::jsonb ELSE NULL END,
    jsonb_build_object(
      'source', 'db_trigger',
      'table', TG_TABLE_NAME,
      'operation', TG_OP
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Criar função para log de alterações de roles via trigger
CREATE OR REPLACE FUNCTION public.log_role_changes()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id, 
    action, 
    entity_type, 
    entity_id, 
    old_data, 
    new_data, 
    metadata
  ) VALUES (
    auth.uid(),
    TG_OP,
    'user_role',
    COALESCE(NEW.user_id, OLD.user_id),
    CASE WHEN TG_OP IN ('DELETE', 'UPDATE') THEN jsonb_build_object('role', OLD.role) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN jsonb_build_object('role', NEW.role) ELSE NULL END,
    jsonb_build_object(
      'source', 'db_trigger',
      'table', 'user_roles',
      'operation', TG_OP,
      'old_role', CASE WHEN OLD IS NOT NULL THEN OLD.role::text ELSE NULL END,
      'new_role', CASE WHEN NEW IS NOT NULL THEN NEW.role::text ELSE NULL END
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Remover triggers existentes se houver (para evitar duplicação)
DROP TRIGGER IF EXISTS audit_usuario_permissoes_telas ON public.usuario_permissoes_telas;
DROP TRIGGER IF EXISTS audit_usuario_permissoes_modulos ON public.usuario_permissoes_modulos;
DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;

-- Criar triggers nas tabelas de permissões
CREATE TRIGGER audit_usuario_permissoes_telas
  AFTER INSERT OR UPDATE OR DELETE ON public.usuario_permissoes_telas
  FOR EACH ROW EXECUTE FUNCTION public.log_permission_changes();

CREATE TRIGGER audit_usuario_permissoes_modulos
  AFTER INSERT OR UPDATE OR DELETE ON public.usuario_permissoes_modulos
  FOR EACH ROW EXECUTE FUNCTION public.log_permission_changes();

-- Criar trigger na tabela de roles
CREATE TRIGGER audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_role_changes();