
-- Must DROP first because column names changed
DROP VIEW IF EXISTS public.social_media_credentials_safe;

CREATE VIEW public.social_media_credentials_safe
WITH (security_invoker = true) AS
SELECT 
  id,
  user_id,
  platform,
  (access_token IS NOT NULL AND access_token <> '') AS has_access_token,
  (refresh_token IS NOT NULL AND refresh_token <> '') AS has_refresh_token,
  token_type,
  expires_at,
  scope,
  created_at,
  updated_at
FROM social_media_credentials;

-- erp_config_safe — must DROP first to add new columns
DROP VIEW IF EXISTS public.erp_config_safe;

CREATE VIEW public.erp_config_safe
WITH (security_invoker = true) AS
SELECT 
  id,
  empresa_id,
  config_key,
  CASE 
    WHEN is_secret = true THEN '***redacted***'
    ELSE config_value
  END AS config_value,
  description,
  is_secret,
  ativo,
  updated_at,
  updated_by,
  (api_key IS NOT NULL AND api_key <> '') AS has_api_key,
  (api_key_hash IS NOT NULL AND api_key_hash <> '') AS has_api_key_hash
FROM erp_config
WHERE config_key <> 'api_key';

-- configuracoes_cobranca_safe — must DROP first to add boolean flags
DROP VIEW IF EXISTS public.configuracoes_cobranca_safe;

CREATE VIEW public.configuracoes_cobranca_safe
WITH (security_invoker = true) AS
SELECT 
  id,
  automacao_ativa,
  hora_inicio_envio,
  hora_fim_envio,
  max_envios_hora,
  intervalo_minimo_dias,
  email_remetente,
  nome_remetente,
  created_at,
  updated_at,
  created_by,
  updated_by,
  (api_key IS NOT NULL AND api_key <> '') AS has_api_key,
  (whatsapp_verify_token IS NOT NULL AND whatsapp_verify_token <> '') AS has_whatsapp_token
FROM configuracoes_cobranca;
