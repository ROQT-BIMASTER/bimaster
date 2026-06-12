-- Migration 1: drop sobrecarga órfã + guarda admin em rpc_erp_keys_status

DROP FUNCTION IF EXISTS public.rpc_china_criar_projeto_espelho(uuid, uuid, uuid, text, text);

CREATE OR REPLACE FUNCTION public.rpc_erp_keys_status()
RETURNS TABLE(empresa_id integer, config_id uuid, expira_em timestamp with time zone, dias_restantes integer, ativo boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem consultar status de chaves ERP' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT c.empresa_id,
           c.id AS config_id,
           c.api_key_expira_em AS expira_em,
           GREATEST(0, EXTRACT(DAY FROM (c.api_key_expira_em - now()))::INT) AS dias_restantes,
           COALESCE(c.ativo, false) AS ativo
      FROM public.erp_config c
     WHERE c.config_key = 'api_key'
       AND c.api_key_expira_em IS NOT NULL;
END;
$function$;