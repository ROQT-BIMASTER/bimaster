-- Audit trail for Central de Trabalho preference resets.
CREATE TABLE public.central_preferences_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reset_type TEXT NOT NULL CHECK (reset_type IN ('full', 'filters_only')),
  previous_preferences JSONB,
  applied_preferences JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_cpa_user_created
  ON public.central_preferences_audit (user_id, created_at DESC);

ALTER TABLE public.central_preferences_audit ENABLE ROW LEVEL SECURITY;

-- Users can read their own audit trail.
CREATE POLICY "Users view own preference audit"
  ON public.central_preferences_audit
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can read everyone's audit trail (uses existing has_role helper).
CREATE POLICY "Admins view all preference audit"
  ON public.central_preferences_audit
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Users can insert their own audit entries.
CREATE POLICY "Users insert own preference audit"
  ON public.central_preferences_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE / DELETE policies → trail is immutable.