-- Migration 5: Create erp_config table
CREATE TABLE public.erp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key varchar(100) UNIQUE NOT NULL,
  config_value text,
  description text,
  is_secret boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);

-- RLS
ALTER TABLE public.erp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read erp_config"
  ON public.erp_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage erp_config"
  ON public.erp_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
