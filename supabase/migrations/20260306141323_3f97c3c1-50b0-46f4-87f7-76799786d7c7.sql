
-- Table to track failed login attempts for account lockout
CREATE TABLE public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false
);

-- Index for fast lookups by email and time
CREATE INDEX idx_login_attempts_email_time ON public.login_attempts (email, attempted_at DESC);

-- Auto-cleanup: delete attempts older than 24 hours
CREATE OR REPLACE FUNCTION public.cleanup_old_login_attempts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  DELETE FROM public.login_attempts WHERE attempted_at < now() - interval '24 hours';
$$;

-- Function to check if account is locked (5+ failed attempts in 15 min)
CREATE OR REPLACE FUNCTION public.check_account_lockout(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  failed_count integer;
  oldest_attempt timestamptz;
  lock_until timestamptz;
BEGIN
  -- Count failed attempts in last 15 minutes
  SELECT count(*), min(attempted_at)
  INTO failed_count, oldest_attempt
  FROM public.login_attempts
  WHERE email = lower(p_email)
    AND success = false
    AND attempted_at > now() - interval '15 minutes';

  IF failed_count >= 5 THEN
    lock_until := oldest_attempt + interval '15 minutes';
    RETURN jsonb_build_object(
      'locked', true,
      'failed_count', failed_count,
      'lock_until', lock_until,
      'remaining_seconds', EXTRACT(EPOCH FROM (lock_until - now()))::integer
    );
  END IF;

  RETURN jsonb_build_object(
    'locked', false,
    'failed_count', failed_count,
    'remaining_attempts', 5 - failed_count
  );
END;
$$;

-- Function to record a login attempt
CREATE OR REPLACE FUNCTION public.record_login_attempt(p_email text, p_success boolean, p_ip text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.login_attempts (email, ip_address, success)
  VALUES (lower(p_email), p_ip, p_success);

  -- If successful login, clear previous failed attempts for this email
  IF p_success THEN
    DELETE FROM public.login_attempts
    WHERE email = lower(p_email) AND success = false;
  END IF;

  -- Cleanup old records periodically (1% chance per call)
  IF random() < 0.01 THEN
    PERFORM public.cleanup_old_login_attempts();
  END IF;
END;
$$;

-- RLS: No direct access to login_attempts table (only via SECURITY DEFINER functions)
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Grant execute on functions to anon (needed for login page before auth)
GRANT EXECUTE ON FUNCTION public.check_account_lockout(text) TO anon;
GRANT EXECUTE ON FUNCTION public.record_login_attempt(text, boolean, text) TO anon;
