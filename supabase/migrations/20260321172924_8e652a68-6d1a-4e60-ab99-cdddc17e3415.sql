
-- 1. Create safe view excluding sensitive columns
CREATE OR REPLACE VIEW public.erp_config_safe
WITH (security_invoker = on)
AS
SELECT
  id,
  empresa_id,
  config_key,
  config_value,
  description,
  is_secret,
  ativo,
  updated_at,
  updated_by
FROM public.erp_config
WHERE config_key != 'api_key';

-- 2. Remove permissive read policy
DROP POLICY IF EXISTS "Authenticated users can read erp_config" ON public.erp_config;

-- 3. Create admin-only SELECT policy
CREATE POLICY "admin_only_read_erp_config"
ON public.erp_config
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 4. Restrict write policies to admin only
DROP POLICY IF EXISTS "Authenticated users can insert erp_config" ON public.erp_config;
DROP POLICY IF EXISTS "Authenticated users can update erp_config" ON public.erp_config;

CREATE POLICY "admin_only_insert_erp_config"
ON public.erp_config
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin_only_update_erp_config"
ON public.erp_config
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
