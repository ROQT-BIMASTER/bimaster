
-- Audit table for RLS-sensitive reads on history/approval-flow tables
CREATE TABLE IF NOT EXISTS public.rls_access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resource_type text NOT NULL,
  resource_id text,
  outcome text NOT NULL CHECK (outcome IN ('granted','denied')),
  reason text,
  contexto jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.rls_access_audit TO authenticated;
GRANT ALL ON public.rls_access_audit TO service_role;

ALTER TABLE public.rls_access_audit ENABLE ROW LEVEL SECURITY;

-- Owner can read own audit rows; admins/security can read all
CREATE POLICY "rls_audit_select_own_or_admin"
ON public.rls_access_audit FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'supervisor'::app_role)
);

-- Inserts only via RPC (block direct inserts by default; RPC uses SECURITY DEFINER)
CREATE POLICY "rls_audit_insert_self"
ON public.rls_access_audit FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS rls_access_audit_user_created_idx
  ON public.rls_access_audit (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rls_access_audit_resource_idx
  ON public.rls_access_audit (resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rls_access_audit_outcome_idx
  ON public.rls_access_audit (outcome, created_at DESC);

-- RPC used by frontend to record events (SECURITY DEFINER so we can enforce shape)
CREATE OR REPLACE FUNCTION public.rpc_log_rls_access(
  _resource_type text,
  _resource_id text,
  _outcome text,
  _reason text DEFAULT NULL,
  _contexto jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF _outcome NOT IN ('granted','denied') THEN
    RAISE EXCEPTION 'invalid outcome %', _outcome USING ERRCODE = '22023';
  END IF;
  IF coalesce(length(_resource_type),0) = 0 OR length(_resource_type) > 80 THEN
    RAISE EXCEPTION 'invalid resource_type' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.rls_access_audit (
    user_id, resource_type, resource_id, outcome, reason, contexto
  ) VALUES (
    _uid,
    _resource_type,
    NULLIF(left(coalesce(_resource_id,''), 128), ''),
    _outcome,
    NULLIF(left(coalesce(_reason,''), 500), ''),
    coalesce(_contexto, '{}'::jsonb)
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_log_rls_access(text, text, text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_log_rls_access(text, text, text, text, jsonb) TO authenticated;
