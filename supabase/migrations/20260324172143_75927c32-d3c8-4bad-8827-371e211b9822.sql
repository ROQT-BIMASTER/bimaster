-- Fix 1: Remove gerente bypass from team_form_submissions SELECT policy
-- Managers should only see submissions linked to tokens they created
DROP POLICY IF EXISTS "authorized_view_submissions_v2" ON public.team_form_submissions;
CREATE POLICY "authorized_view_submissions_v2" ON public.team_form_submissions
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM team_form_tokens t
      WHERE t.id = team_form_submissions.token_id
        AND t.created_by = auth.uid()
    )
  );

-- Fix 2: Restrict configuracoes_cobranca SELECT to admin only
-- Supervisors should use configuracoes_cobranca_safe view instead
DROP POLICY IF EXISTS "admins_select_cobranca" ON public.configuracoes_cobranca;
CREATE POLICY "admins_select_cobranca" ON public.configuracoes_cobranca
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
  );