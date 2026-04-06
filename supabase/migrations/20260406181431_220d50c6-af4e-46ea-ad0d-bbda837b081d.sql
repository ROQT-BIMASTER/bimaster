
-- Recreate user_can_access_projeto as PL/pgSQL with denied-access audit logging
CREATE OR REPLACE FUNCTION public.user_can_access_projeto(_user_id uuid, _projeto_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _has_access boolean;
BEGIN
  SELECT
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'admin')
    OR EXISTS (SELECT 1 FROM projetos WHERE id = _projeto_id AND criador_id = _user_id)
    OR EXISTS (SELECT 1 FROM projeto_membros WHERE projeto_id = _projeto_id AND user_id = _user_id)
    OR EXISTS (
      SELECT 1 FROM projeto_departamentos pd
      JOIN profiles pr ON pr.departamento_id = pd.departamento_id
      WHERE pd.projeto_id = _projeto_id AND pr.id = _user_id
    )
  INTO _has_access;

  IF NOT COALESCE(_has_access, false) THEN
    INSERT INTO security_audit_log (action, severity, user_id, metadata)
    VALUES (
      'project_access_denied',
      'medium',
      _user_id,
      jsonb_build_object(
        'projeto_id', _projeto_id,
        'user_departamento_id', (SELECT departamento_id FROM profiles WHERE id = _user_id),
        'projeto_departamentos', (SELECT coalesce(array_agg(departamento_id), ARRAY[]::uuid[]) FROM projeto_departamentos WHERE projeto_id = _projeto_id)
      )
    );
  END IF;

  RETURN COALESCE(_has_access, false);
END;
$$;
