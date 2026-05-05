CREATE OR REPLACE FUNCTION public.rpc_update_member_avatar(_member_id uuid, _avatar_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _allowed boolean := false;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  -- self
  IF _caller = _member_id THEN
    _allowed := true;
  -- admin
  ELSIF has_role(_caller, 'admin'::app_role) THEN
    _allowed := true;
  ELSE
    -- supervisor / gerente direto (recursivo via supervisor_id)
    WITH RECURSIVE chain AS (
      SELECT id, supervisor_id FROM profiles WHERE id = _member_id
      UNION ALL
      SELECT p.id, p.supervisor_id
      FROM profiles p
      JOIN chain c ON c.supervisor_id = p.id
    )
    SELECT EXISTS (SELECT 1 FROM chain WHERE supervisor_id = _caller)
    INTO _allowed;
  END IF;

  IF NOT _allowed THEN
    RAISE EXCEPTION 'forbidden: cannot update this member avatar';
  END IF;

  UPDATE profiles SET avatar_url = _avatar_url WHERE id = _member_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_update_member_avatar(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_update_member_avatar(uuid, text) TO authenticated;