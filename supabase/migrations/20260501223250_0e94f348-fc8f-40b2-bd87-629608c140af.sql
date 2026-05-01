CREATE OR REPLACE FUNCTION public.verify_user_password(password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  uid uuid := auth.uid();
  encrypted text;
BEGIN
  IF uid IS NULL THEN
    RETURN false;
  END IF;
  SELECT encrypted_password INTO encrypted FROM auth.users WHERE id = uid;
  IF encrypted IS NULL THEN
    RETURN false;
  END IF;
  RETURN encrypted = crypt(password, encrypted);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_user_password(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_user_password(text) TO authenticated;