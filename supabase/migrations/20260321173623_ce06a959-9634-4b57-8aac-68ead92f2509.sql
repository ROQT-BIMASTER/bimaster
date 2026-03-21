-- Migration 2: Remover UUIDs hardcoded de team_form_tokens

-- Drop policies com UUIDs hardcoded
DROP POLICY IF EXISTS "authorized_view_tokens" ON public.team_form_tokens;
DROP POLICY IF EXISTS "authorized_insert_tokens" ON public.team_form_tokens;

-- Recriar com roles ao invés de UUIDs
CREATE POLICY "authorized_view_tokens" ON public.team_form_tokens
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente'::public.app_role)
    OR created_by = auth.uid()
  );

CREATE POLICY "authorized_insert_tokens" ON public.team_form_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'gerente'::public.app_role)
    )
  );
