-- 1. Corrigir policy permissiva em idempotency_keys
-- A policy atual aplica a {public} (anon + authenticated) com USING/WITH CHECK = true,
-- expondo response_body com payloads sensíveis. Deve ser restrita a service_role.
DROP POLICY IF EXISTS "Service role full access on idempotency_keys" ON public.idempotency_keys;

CREATE POLICY "Service role full access on idempotency_keys"
ON public.idempotency_keys
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 2. Restringir listagem de buckets públicos a usuários autenticados
-- Mantém o bucket público (URLs diretas funcionam), mas impede enumeração por anônimos
DROP POLICY IF EXISTS "Anyone can view trade banners" ON storage.objects;
CREATE POLICY "Authenticated can view trade banners"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'trade-banners');

DROP POLICY IF EXISTS "Public read creative-studio" ON storage.objects;
CREATE POLICY "Authenticated read creative-studio"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'creative-studio');