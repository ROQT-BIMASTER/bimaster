
-- 1. Fix usuario_tem_acesso_loja to use is_admin_or_supervisor (includes gerente)
CREATE OR REPLACE FUNCTION public.usuario_tem_acesso_loja(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_vendedor_id uuid;
  v_supervisor_id uuid;
BEGIN
  -- Buscar vendedor e supervisor da loja
  SELECT vendedor_id, supervisor_id INTO v_vendedor_id, v_supervisor_id
  FROM stores
  WHERE id = _store_id;
  
  -- Admin, Gerente ou Supervisor vê tudo
  IF is_admin_or_supervisor(_user_id) THEN
    -- Admin vê tudo; Gerente/Supervisor veem lojas de subordinados
    IF has_role(_user_id, 'admin') THEN
      RETURN true;
    END IF;
    
    -- Se a loja está vinculada diretamente
    IF v_supervisor_id = _user_id THEN
      RETURN true;
    END IF;
    
    -- Se a loja está vinculada a um vendedor subordinado
    IF v_vendedor_id IS NOT NULL AND is_supervisor_of(_user_id, v_vendedor_id) THEN
      RETURN true;
    END IF;
  END IF;
  
  -- Vendedor/Promotor vê apenas suas próprias lojas
  IF v_vendedor_id = _user_id THEN
    RETURN true;
  END IF;
  
  -- Se foi criado por ele
  IF EXISTS (SELECT 1 FROM stores WHERE id = _store_id AND created_by = _user_id) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- 2. Fix get_subordinados to filter inactive users
CREATE OR REPLACE FUNCTION public.get_subordinados(_user_id uuid)
RETURNS TABLE(subordinado_id uuid)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE hierarchy AS (
    -- Começar com subordinados diretos ATIVOS
    SELECT id
    FROM profiles
    WHERE supervisor_id = _user_id
      AND status = 'ativo'
    
    UNION ALL
    
    -- Descer na hierarquia (somente ativos)
    SELECT p.id
    FROM profiles p
    INNER JOIN hierarchy h ON p.supervisor_id = h.id
    WHERE p.status = 'ativo'
  )
  SELECT id FROM hierarchy;
END;
$$;

-- 3. Audit trigger for supervisor_id changes
CREATE OR REPLACE FUNCTION public.audit_supervisor_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF OLD.supervisor_id IS DISTINCT FROM NEW.supervisor_id THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      entity_type,
      entity_id,
      old_data,
      new_data,
      metadata
    ) VALUES (
      auth.uid(),
      'hierarchy_change',
      'profile_supervisor',
      NEW.id,
      jsonb_build_object('supervisor_id', OLD.supervisor_id),
      jsonb_build_object('supervisor_id', NEW.supervisor_id),
      jsonb_build_object(
        'user_name', NEW.nome,
        'changed_at', now()
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Drop if exists to avoid duplicate
DROP TRIGGER IF EXISTS trg_audit_supervisor_change ON profiles;

CREATE TRIGGER trg_audit_supervisor_change
AFTER UPDATE OF supervisor_id ON profiles
FOR EACH ROW
EXECUTE FUNCTION audit_supervisor_change();

-- 4. Add deprecation comment on gerente_id column
COMMENT ON COLUMN profiles.gerente_id IS 'DEPRECATED: Use supervisor_id instead. This column is kept for backward compatibility only.';
