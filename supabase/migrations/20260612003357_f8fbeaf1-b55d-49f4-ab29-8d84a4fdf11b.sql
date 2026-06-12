
ALTER TABLE public.erp_config
  ADD COLUMN IF NOT EXISTS api_key_anterior_hash TEXT;

CREATE OR REPLACE FUNCTION public.rpc_rotate_erp_api_key(
  p_empresa_id INT,
  p_grace_days INT DEFAULT 7,
  p_validity_days INT DEFAULT 90
)
RETURNS TABLE(new_api_key TEXT, expires_at TIMESTAMPTZ, grace_until TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_key TEXT;
  v_new_hash TEXT;
  v_expires TIMESTAMPTZ;
  v_grace TIMESTAMPTZ;
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem rotacionar chaves' USING ERRCODE = '42501';
  END IF;
  IF p_grace_days < 0 OR p_grace_days > 30 THEN
    RAISE EXCEPTION 'grace_days deve estar entre 0 e 30';
  END IF;
  IF p_validity_days < 7 OR p_validity_days > 365 THEN
    RAISE EXCEPTION 'validity_days deve estar entre 7 e 365';
  END IF;

  v_new_key := encode(gen_random_bytes(32), 'hex');
  v_new_hash := encode(digest(v_new_key, 'sha256'), 'hex');
  v_expires := now() + (p_validity_days || ' days')::interval;
  v_grace := now() + (p_grace_days || ' days')::interval;

  UPDATE public.erp_config c
     SET api_key_anterior_hash = c.api_key_hash,
         api_key_anterior_expira_em = CASE WHEN c.api_key_hash IS NOT NULL OR c.api_key IS NOT NULL
                                           THEN v_grace ELSE NULL END,
         api_key_hash = v_new_hash,
         api_key = NULL,
         api_key_expira_em = v_expires,
         ativo = TRUE,
         updated_at = now(),
         updated_by = v_uid
   WHERE c.empresa_id = p_empresa_id
     AND c.config_key = 'api_key';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Configuração ERP não encontrada para empresa %', p_empresa_id;
  END IF;

  RETURN QUERY SELECT v_new_key, v_expires, v_grace;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_rotate_erp_api_key(INT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_rotate_erp_api_key(INT, INT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_erp_keys_status()
RETURNS TABLE(
  empresa_id INT,
  config_id UUID,
  expira_em TIMESTAMPTZ,
  dias_restantes INT,
  ativo BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id,
         id AS config_id,
         api_key_expira_em AS expira_em,
         GREATEST(0, EXTRACT(DAY FROM (api_key_expira_em - now()))::INT) AS dias_restantes,
         COALESCE(ativo, false) AS ativo
    FROM public.erp_config
   WHERE config_key = 'api_key'
     AND api_key_expira_em IS NOT NULL
$$;

REVOKE ALL ON FUNCTION public.rpc_erp_keys_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_erp_keys_status() TO authenticated, service_role;
