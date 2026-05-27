
-- ============================================================
-- #1 CRM webhook secrets — column-level lockdown + admin RPC
-- ============================================================
REVOKE SELECT (webhook_secret, bot_key_cifrada) ON public.crm_bots FROM authenticated, anon;
REVOKE SELECT (secret) ON public.crm_webhook_endpoints FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.crm_get_bot_secret(_bot_id uuid)
RETURNS TABLE(webhook_secret text, bot_key_cifrada text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp integer;
BEGIN
  SELECT empresa_id INTO v_emp FROM public.crm_bots WHERE id = _bot_id;
  IF v_emp IS NULL THEN
    RAISE EXCEPTION 'bot not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.crm_is_admin(v_emp) THEN
    RAISE EXCEPTION 'forbidden: admin role required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT b.webhook_secret, b.bot_key_cifrada
    FROM public.crm_bots b
    WHERE b.id = _bot_id;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_get_bot_secret(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_get_bot_secret(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_get_webhook_endpoint_secret(_endpoint_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp integer;
  v_secret text;
BEGIN
  SELECT empresa_id, secret INTO v_emp, v_secret
  FROM public.crm_webhook_endpoints WHERE id = _endpoint_id;
  IF v_emp IS NULL THEN
    RAISE EXCEPTION 'endpoint not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.crm_is_admin(v_emp) THEN
    RAISE EXCEPTION 'forbidden: admin role required' USING ERRCODE = '42501';
  END IF;
  RETURN v_secret;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_get_webhook_endpoint_secret(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_get_webhook_endpoint_secret(uuid) TO authenticated;

-- ============================================================
-- #2 trade-banners — role-restricted upload/update
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can upload trade banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update trade banners" ON storage.objects;

CREATE POLICY "Trade banners insert role-restricted"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'trade-banners'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
    OR public.has_role(auth.uid(), 'marketing'::app_role)
  )
);

CREATE POLICY "Trade banners update role-restricted"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'trade-banners'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
    OR public.has_role(auth.uid(), 'marketing'::app_role)
  )
)
WITH CHECK (
  bucket_id = 'trade-banners'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
    OR public.has_role(auth.uid(), 'marketing'::app_role)
  )
);

-- ============================================================
-- #3 configuracoes_cobranca — column-level revoke
-- (frontend já usa view _safe; edge functions usam service_role)
-- ============================================================
REVOKE SELECT (api_key, whatsapp_verify_token) ON public.configuracoes_cobranca FROM authenticated, anon;
REVOKE UPDATE (api_key, whatsapp_verify_token) ON public.configuracoes_cobranca FROM authenticated, anon;
REVOKE INSERT (api_key, whatsapp_verify_token) ON public.configuracoes_cobranca FROM authenticated, anon;
