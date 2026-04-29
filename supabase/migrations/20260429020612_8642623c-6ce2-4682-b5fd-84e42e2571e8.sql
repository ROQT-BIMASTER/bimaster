-- Tabela de overrides de governança para funções SECURITY DEFINER
CREATE TABLE public.security_definer_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schema_name TEXT NOT NULL,
  function_name TEXT NOT NULL,
  function_signature TEXT NOT NULL,
  status_override TEXT CHECK (status_override IN ('mantida','ajustada','revogada')),
  nota TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (schema_name, function_name, function_signature)
);

ALTER TABLE public.security_definer_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin lê overrides de SECURITY DEFINER"
  ON public.security_definer_overrides
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin grava overrides de SECURITY DEFINER"
  ON public.security_definer_overrides
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger genérico de updated_at (cria função local se não existir uma compatível)
CREATE OR REPLACE FUNCTION public.security_definer_overrides_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_security_definer_overrides_touch
  BEFORE UPDATE ON public.security_definer_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.security_definer_overrides_touch();

CREATE INDEX idx_security_definer_overrides_lookup
  ON public.security_definer_overrides (schema_name, function_name);