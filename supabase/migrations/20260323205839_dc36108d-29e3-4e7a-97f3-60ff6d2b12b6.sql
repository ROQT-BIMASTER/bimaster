
-- 1. Perfis de acesso ao Portal ERP
CREATE TABLE public.erp_portal_access_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.erp_portal_access_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage access profiles"
  ON public.erp_portal_access_profiles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Módulos/APIs liberados por perfil
CREATE TABLE public.erp_portal_access_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.erp_portal_access_profiles(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  api_id TEXT,
  visivel BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.erp_portal_access_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage access modules"
  ON public.erp_portal_access_modules
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Unique constraint to prevent duplicates
CREATE UNIQUE INDEX idx_erp_access_modules_unique 
  ON public.erp_portal_access_modules (profile_id, module_id, COALESCE(api_id, '__MODULE__'));

-- 3. Add access_profile_id to erp_api_keys
ALTER TABLE public.erp_api_keys 
  ADD COLUMN access_profile_id UUID REFERENCES public.erp_portal_access_profiles(id) ON DELETE SET NULL;
