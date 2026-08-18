CREATE TABLE IF NOT EXISTS public.upload_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  module text NOT NULL,
  status text NOT NULL CHECK (status IN ('success','rejected','error')),
  reason text,
  error_code text,
  message text,
  file_name text,
  file_type text,
  file_size bigint,
  context_id text,
  page_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.upload_audit_events TO authenticated;
GRANT ALL ON public.upload_audit_events TO service_role;

ALTER TABLE public.upload_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "upload_audit_insert_own"
ON public.upload_audit_events FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "upload_audit_select_own"
ON public.upload_audit_events FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "upload_audit_select_admin"
ON public.upload_audit_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_upload_audit_created_at ON public.upload_audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_upload_audit_module_status ON public.upload_audit_events (module, status, created_at DESC);