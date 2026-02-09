
-- =============================================
-- 1. team_member_details: Add deny_anonymous policy
-- =============================================
CREATE POLICY "deny_anonymous_team_member_details"
ON public.team_member_details
FOR ALL
TO anon
USING (false);

-- Restrict supervisor access to read-only (they shouldn't edit other's personal data)
DROP POLICY IF EXISTS "supervisor_team_access" ON public.team_member_details;

CREATE POLICY "supervisor_team_read_access"
ON public.team_member_details
FOR SELECT
USING (
  has_role(auth.uid(), 'supervisor'::app_role) 
  AND is_supervisor_of(auth.uid(), user_id)
);

-- Own record: user can only SELECT and UPDATE their own (not INSERT/DELETE which admin handles)
DROP POLICY IF EXISTS "own_record_access" ON public.team_member_details;

CREATE POLICY "own_record_select"
ON public.team_member_details
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "own_record_update"
ON public.team_member_details
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- =============================================
-- 2. contas_receber: Tighten access to financial roles only
-- =============================================
DROP POLICY IF EXISTS "cr_select" ON public.contas_receber;
DROP POLICY IF EXISTS "cr_insert" ON public.contas_receber;
DROP POLICY IF EXISTS "cr_update" ON public.contas_receber;

-- SELECT: admin OR users with financeiro module access
CREATE POLICY "cr_select_strict"
ON public.contas_receber
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR check_user_access(auth.uid(), 'financeiro'::text)
);

-- INSERT: only admin
CREATE POLICY "cr_insert_strict"
ON public.contas_receber
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
);

-- UPDATE: admin or financeiro module
CREATE POLICY "cr_update_strict"
ON public.contas_receber
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR check_user_access(auth.uid(), 'financeiro'::text)
);
