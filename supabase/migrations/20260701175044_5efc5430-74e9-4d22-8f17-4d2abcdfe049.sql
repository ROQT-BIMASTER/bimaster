
-- 1) marketing_points_history — restringe SELECT
DROP POLICY IF EXISTS "Users can view points history" ON public.marketing_points_history;

CREATE POLICY "Users view own points history"
ON public.marketing_points_history
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'supervisor')
);

-- 2) dynamic_form_responses — INSERT anônimo exige token válido
DROP POLICY IF EXISTS "Anyone can submit responses" ON public.dynamic_form_responses;

CREATE POLICY "Anon submit requires valid token"
ON public.dynamic_form_responses
FOR INSERT
TO anon
WITH CHECK (
  token_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.dynamic_forms df
    JOIN public.team_form_tokens t ON t.id = dynamic_form_responses.token_id
    WHERE df.id = dynamic_form_responses.form_id
      AND df.status = 'active'
      AND t.status = 'active'
      AND (t.expires_at IS NULL OR t.expires_at > now())
      AND (t.max_uses IS NULL OR t.use_count < t.max_uses)
  )
);

CREATE POLICY "Authenticated submit to active forms"
ON public.dynamic_form_responses
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.dynamic_forms df
    WHERE df.id = dynamic_form_responses.form_id
      AND df.status = 'active'
  )
);
