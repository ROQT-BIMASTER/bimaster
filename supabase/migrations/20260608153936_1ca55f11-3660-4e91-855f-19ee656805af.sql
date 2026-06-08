
-- =============================================================
-- 1) profile_reveal_grants — concessões ativas/expiradas de revelação
-- =============================================================
CREATE TABLE public.profile_reveal_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  hidden_at TIMESTAMPTZ,
  ip INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profile_reveal_grants_field_check CHECK (field IN ('cpf','rg','email'))
);

CREATE INDEX idx_profile_reveal_grants_user ON public.profile_reveal_grants (user_id, granted_at DESC);
CREATE INDEX idx_profile_reveal_grants_expires ON public.profile_reveal_grants (expires_at);

GRANT SELECT ON public.profile_reveal_grants TO authenticated;
GRANT ALL ON public.profile_reveal_grants TO service_role;

ALTER TABLE public.profile_reveal_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profile_reveal_grants_select_own"
  ON public.profile_reveal_grants FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- INSERT/UPDATE só via service_role (edge function); sem policy para authenticated.

-- =============================================================
-- 2) profile_reveal_attempts — tentativas de senha (rate limit)
-- =============================================================
CREATE TABLE public.profile_reveal_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  success BOOLEAN NOT NULL,
  ip INET,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profile_reveal_attempts_user_time
  ON public.profile_reveal_attempts (user_id, attempted_at DESC);

GRANT SELECT ON public.profile_reveal_attempts TO authenticated;
GRANT ALL ON public.profile_reveal_attempts TO service_role;

ALTER TABLE public.profile_reveal_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profile_reveal_attempts_select_own"
  ON public.profile_reveal_attempts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- =============================================================
-- 3) RPC: usuário marca manualmente uma concessão como oculta
-- =============================================================
CREATE OR REPLACE FUNCTION public.mark_profile_reveal_hidden(_grant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID;
BEGIN
  SELECT user_id INTO v_user
    FROM public.profile_reveal_grants
   WHERE id = _grant_id;

  IF v_user IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_user <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.profile_reveal_grants
     SET hidden_at = COALESCE(hidden_at, now())
   WHERE id = _grant_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_profile_reveal_hidden(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_profile_reveal_hidden(UUID) TO authenticated;
