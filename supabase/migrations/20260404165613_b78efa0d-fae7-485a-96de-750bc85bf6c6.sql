
CREATE TABLE public.security_pentest_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  total_tests INT NOT NULL DEFAULT 0,
  passed INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  warnings INT NOT NULL DEFAULT 0,
  details JSONB DEFAULT '[]'::jsonb,
  score NUMERIC(4,1) DEFAULT 0.0
);

ALTER TABLE public.security_pentest_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view pentest reports"
ON public.security_pentest_reports FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert pentest reports"
ON public.security_pentest_reports FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
