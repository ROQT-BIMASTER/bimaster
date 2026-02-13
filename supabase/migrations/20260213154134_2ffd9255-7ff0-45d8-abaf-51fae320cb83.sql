
-- =============================================
-- HARDENING: team_form_submissions RLS
-- Bloquear supervisores não autorizados
-- =============================================

-- 1. Remover políticas antigas permissivas
DROP POLICY IF EXISTS "Token creators can view submissions" ON public.team_form_submissions;
DROP POLICY IF EXISTS "Token creators can update submissions" ON public.team_form_submissions;

-- 2. Bloquear acesso anônimo completamente
CREATE POLICY "deny_anon_submissions"
ON public.team_form_submissions
AS RESTRICTIVE
FOR ALL
TO anon
USING (false);

-- 3. SELECT: Apenas admin, Milene (7eb17733) e Jessika (23d470c6) + criador do token
CREATE POLICY "authorized_view_submissions"
ON public.team_form_submissions
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR auth.uid() = '7eb17733-d824-4758-8ddf-7b9606ef4991'::uuid  -- Milene Harumi
  OR auth.uid() = '23d470c6-7a46-4643-9a45-ef082fe808e1'::uuid  -- Jessika Marcondes
  OR EXISTS (
    SELECT 1 FROM team_form_tokens t
    WHERE t.id = team_form_submissions.token_id 
    AND t.created_by = auth.uid()
  )
);

-- 4. UPDATE: Apenas admin + criador do token
CREATE POLICY "authorized_update_submissions"
ON public.team_form_submissions
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM team_form_tokens t
    WHERE t.id = team_form_submissions.token_id 
    AND t.created_by = auth.uid()
  )
);

-- 5. DELETE: Apenas admin + criador do token
CREATE POLICY "authorized_delete_submissions"
ON public.team_form_submissions
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM team_form_tokens t
    WHERE t.id = team_form_submissions.token_id 
    AND t.created_by = auth.uid()
  )
);

-- 6. INSERT: Ninguém pelo frontend (edge function usa service role)
CREATE POLICY "no_direct_insert_submissions"
ON public.team_form_submissions
FOR INSERT
TO authenticated
WITH CHECK (false);

-- =============================================
-- HARDENING: team_form_tokens RLS
-- =============================================

-- Remover políticas antigas
DROP POLICY IF EXISTS "Authenticated users can view tokens they created" ON public.team_form_tokens;
DROP POLICY IF EXISTS "Authenticated users can insert tokens" ON public.team_form_tokens;
DROP POLICY IF EXISTS "Authenticated users can update their tokens" ON public.team_form_tokens;

-- Bloquear anon
CREATE POLICY "deny_anon_tokens"
ON public.team_form_tokens
AS RESTRICTIVE
FOR ALL
TO anon
USING (false);

-- SELECT: admin + Milene + Jessika + criador
CREATE POLICY "authorized_view_tokens"
ON public.team_form_tokens
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR auth.uid() = '7eb17733-d824-4758-8ddf-7b9606ef4991'::uuid
  OR auth.uid() = '23d470c6-7a46-4643-9a45-ef082fe808e1'::uuid
  OR created_by = auth.uid()
);

-- INSERT: admin + Milene + Jessika
CREATE POLICY "authorized_insert_tokens"
ON public.team_form_tokens
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR auth.uid() = '7eb17733-d824-4758-8ddf-7b9606ef4991'::uuid
    OR auth.uid() = '23d470c6-7a46-4643-9a45-ef082fe808e1'::uuid
  )
);

-- UPDATE: admin + criador
CREATE POLICY "authorized_update_tokens"
ON public.team_form_tokens
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR created_by = auth.uid()
);

-- DELETE: admin + criador  
CREATE POLICY "authorized_delete_tokens"
ON public.team_form_tokens
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR created_by = auth.uid()
);
