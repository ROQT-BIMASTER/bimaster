
-- =================================================================
-- Migração: Criar Hierarquia de Gerente e Configurar Milene Harumi
-- =================================================================

-- 1. Alterar role da Milene de 'supervisor' para 'gerente'
UPDATE public.user_roles 
SET role = 'gerente' 
WHERE user_id = '7eb17733-d824-4758-8ddf-7b9606ef4991';

-- 2. Vincular supervisoras Jessika e Michele à Milene como superior
UPDATE public.profiles 
SET supervisor_id = '7eb17733-d824-4758-8ddf-7b9606ef4991' 
WHERE id IN (
  '23d470c6-7a46-4643-9a45-ef082fe808e1',  -- Jessika
  '9b55c37f-e2c4-4064-9c89-1838f4e482fc'   -- Michele
);

-- 3. Atualizar is_admin_or_supervisor para incluir 'gerente'
-- Isso corrige automaticamente as 43+ políticas RLS que usam esta função
CREATE OR REPLACE FUNCTION public.is_admin_or_supervisor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = _user_id 
    AND role IN ('admin', 'supervisor', 'gerente')
  )
$$;

-- 4. Atualizar has_role_or_higher para incluir gerente na hierarquia
-- admin=1, gerente=2, supervisor=3, vendedor=4, promotor=5
CREATE OR REPLACE FUNCTION public.has_role_or_higher(_user_id uuid, _min_role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role app_role;
  role_hierarchy INTEGER;
  min_role_hierarchy INTEGER;
BEGIN
  SELECT role INTO user_role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1;
  
  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  role_hierarchy := CASE user_role
    WHEN 'admin' THEN 1
    WHEN 'gerente' THEN 2
    WHEN 'supervisor' THEN 3
    WHEN 'vendedor' THEN 4
    WHEN 'promotor' THEN 5
    ELSE 99
  END;
  
  min_role_hierarchy := CASE _min_role
    WHEN 'admin' THEN 1
    WHEN 'gerente' THEN 2
    WHEN 'supervisor' THEN 3
    WHEN 'vendedor' THEN 4
    WHEN 'promotor' THEN 5
    ELSE 99
  END;
  
  RETURN role_hierarchy <= min_role_hierarchy;
END;
$$;
