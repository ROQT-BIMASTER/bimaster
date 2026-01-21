
-- ============================================
-- CORREÇÃO DE SEGURANÇA - Remover políticas públicas e com USING(true)
-- ============================================

-- 1. PROFILES: Remover políticas com roles public (permite acesso anônimo)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Recriar com roles authenticated apenas
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Bloquear acesso anônimo explicitamente
CREATE POLICY "profiles_deny_anonymous"
ON public.profiles FOR SELECT
TO anon
USING (false);

-- 2. COMPETITOR_PRODUCTS: Remover política pública com USING(true)
DROP POLICY IF EXISTS "Usuários podem ver produtos concorrentes" ON public.competitor_products;
DROP POLICY IF EXISTS "Usuários podem criar produtos concorrentes" ON public.competitor_products;
DROP POLICY IF EXISTS "Admins podem deletar produtos concorrentes" ON public.competitor_products;
DROP POLICY IF EXISTS "Criadores podem atualizar produtos concorrentes" ON public.competitor_products;

-- Bloquear acesso anônimo
CREATE POLICY "competitor_products_deny_anonymous"
ON public.competitor_products FOR SELECT
TO anon
USING (false);

-- 3. AI_CALL_TRANSCRIPTIONS: Corrigir roles public para authenticated
DROP POLICY IF EXISTS "Supervisores podem gerenciar transcrições" ON public.ai_call_transcriptions;

CREATE POLICY "Supervisores podem gerenciar transcrições"
ON public.ai_call_transcriptions FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));

-- Bloquear acesso anônimo
CREATE POLICY "ai_call_transcriptions_deny_anonymous"
ON public.ai_call_transcriptions FOR SELECT
TO anon
USING (false);

-- 4. CONTAS_RECEBER: Bloquear acesso anônimo
CREATE POLICY "contas_receber_deny_anonymous"
ON public.contas_receber FOR SELECT
TO anon
USING (false);

-- 5. AI_CALLS: Bloquear acesso anônimo
CREATE POLICY "ai_calls_deny_anonymous"
ON public.ai_calls FOR SELECT
TO anon
USING (false);
