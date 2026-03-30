
-- ============================================
-- FIX 1: Secure configuracoes_cobranca_safe view
-- Recreate with security_invoker so RLS of parent table applies
-- ============================================
DROP VIEW IF EXISTS public.configuracoes_cobranca_safe;
CREATE VIEW public.configuracoes_cobranca_safe
WITH (security_invoker = true)
AS
SELECT id,
  CASE
    WHEN (api_key IS NOT NULL AND api_key <> '') THEN '***'
    ELSE ''
  END AS api_key,
  CASE
    WHEN (whatsapp_verify_token IS NOT NULL AND whatsapp_verify_token <> '') THEN '***'
    ELSE ''
  END AS whatsapp_verify_token,
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
  updated_by
FROM configuracoes_cobranca;

-- ============================================
-- FIX 2: Secure erp_config_safe view
-- ============================================
DROP VIEW IF EXISTS public.erp_config_safe;
CREATE VIEW public.erp_config_safe
WITH (security_invoker = true)
AS
SELECT id,
  empresa_id,
  config_key,
  config_value,
  description,
  is_secret,
  ativo,
  updated_at,
  updated_by
FROM erp_config
WHERE config_key <> 'api_key';

-- ============================================
-- FIX 3: Remove public/anon SELECT policies from private storage buckets
-- ============================================
DROP POLICY IF EXISTS "Public read access for attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for department-expense-docs" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for event-expense-docs" ON storage.objects;
DROP POLICY IF EXISTS "Trade docs are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to fluxo-artes" ON storage.objects;
DROP POLICY IF EXISTS "Campaign evidence is publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can view all marketing assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view produto images" ON storage.objects;

-- Replace with authenticated-only policies where missing
-- (Some buckets already have authenticated SELECT policies, only add where missing)

-- fluxo-artes: needs authenticated read
CREATE POLICY "Auth users can read fluxo-artes"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'fluxo-artes');

-- marketing-assets: needs authenticated read
CREATE POLICY "Auth users can read marketing-assets"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'marketing-assets');

-- produto-brasil-imagens: needs authenticated read
CREATE POLICY "Auth users can read produto-brasil-imagens"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'produto-brasil-imagens');

-- ============================================
-- FIX 4: Tighten permissive RLS on dynamic_form_responses/answers
-- Replace WITH CHECK(true) with proper validation
-- ============================================
DROP POLICY IF EXISTS "Anyone can submit responses" ON public.dynamic_form_responses;
CREATE POLICY "Anyone can submit responses"
ON public.dynamic_form_responses FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.dynamic_forms
    WHERE dynamic_forms.id = dynamic_form_responses.form_id
    AND dynamic_forms.status = 'active'
  )
);

DROP POLICY IF EXISTS "Anyone can submit answers" ON public.dynamic_form_answers;
CREATE POLICY "Anyone can submit answers"
ON public.dynamic_form_answers FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.dynamic_form_responses r
    JOIN public.dynamic_forms f ON f.id = r.form_id
    WHERE r.id = dynamic_form_answers.response_id
    AND f.status = 'active'
  )
);
