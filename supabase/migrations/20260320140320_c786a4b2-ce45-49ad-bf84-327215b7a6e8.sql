
-- Create erp_api_keys table
CREATE TABLE IF NOT EXISTS public.erp_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT NOT NULL,
  key_preview TEXT NOT NULL,
  empresa_id TEXT NOT NULL,
  nome_responsavel TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  max_requests INTEGER NOT NULL DEFAULT 1000,
  request_count INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.erp_api_keys ENABLE ROW LEVEL SECURITY;

-- Only admins can manage keys
CREATE POLICY "Admins full access to erp_api_keys"
  ON public.erp_api_keys FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Function to validate and increment erp_api_keys (used by edge functions)
CREATE OR REPLACE FUNCTION public.validate_erp_api_key(p_key_hash TEXT)
RETURNS TABLE(id UUID, empresa_id TEXT, valid BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_empresa TEXT;
  v_active BOOLEAN;
  v_expires TIMESTAMPTZ;
  v_count INTEGER;
  v_max INTEGER;
BEGIN
  SELECT eak.id, eak.empresa_id, eak.active, eak.expires_at, eak.request_count, eak.max_requests
  INTO v_id, v_empresa, v_active, v_expires, v_count, v_max
  FROM erp_api_keys eak
  WHERE eak.key_hash = p_key_hash
  LIMIT 1;

  IF v_id IS NULL OR NOT v_active OR v_expires < now() OR v_count >= v_max THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, false;
    RETURN;
  END IF;

  UPDATE erp_api_keys SET request_count = request_count + 1 WHERE erp_api_keys.id = v_id;

  RETURN QUERY SELECT v_id, v_empresa, true;
END;
$$;
