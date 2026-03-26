
-- Fix: get_empresa_ids_do_usuario() must bypass for admin/supervisor/gerente roles
-- These roles have full visibility per security/financial-data-access-logic memory
CREATE OR REPLACE FUNCTION public.get_empresa_ids_do_usuario()
RETURNS integer[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
        AND role IN ('admin', 'supervisor', 'gerente')
    )
    THEN ARRAY(SELECT id FROM empresas WHERE ativa = true)
    ELSE COALESCE(
      ARRAY(SELECT empresa_id FROM user_empresas WHERE user_id = auth.uid()),
      ARRAY[]::integer[]
    )
  END;
$$;
