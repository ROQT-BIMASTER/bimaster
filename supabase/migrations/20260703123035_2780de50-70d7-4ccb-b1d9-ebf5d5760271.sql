
CREATE TABLE IF NOT EXISTS public.access_denied_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text,
  screen_code text NOT NULL,
  route text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.access_denied_audit TO authenticated;
GRANT ALL ON public.access_denied_audit TO service_role;

ALTER TABLE public.access_denied_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view access denials"
  ON public.access_denied_audit FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_access_denied_audit_user ON public.access_denied_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_access_denied_audit_created_at ON public.access_denied_audit(created_at DESC);

CREATE OR REPLACE FUNCTION public.log_access_denied(_screen_code text, _route text, _user_agent text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN; -- só registra usuários autenticados
  END IF;

  SELECT email INTO v_email FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.access_denied_audit (user_id, user_email, screen_code, route, user_agent)
  VALUES (auth.uid(), v_email, _screen_code, _route, _user_agent);
END;
$$;

REVOKE ALL ON FUNCTION public.log_access_denied(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_access_denied(text, text, text) TO authenticated;
