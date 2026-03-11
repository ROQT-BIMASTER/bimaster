-- ============================================================
-- Fix 1: Consolidate team_member_details RLS policies
-- ============================================================

DROP POLICY IF EXISTS "admin_gerente_full_access" ON public.team_member_details;
DROP POLICY IF EXISTS "deny_anon_team_member_details" ON public.team_member_details;
DROP POLICY IF EXISTS "deny_anonymous_team_member_details" ON public.team_member_details;
DROP POLICY IF EXISTS "own_record_select" ON public.team_member_details;
DROP POLICY IF EXISTS "own_record_update" ON public.team_member_details;
DROP POLICY IF EXISTS "team_details_delete_strict" ON public.team_member_details;
DROP POLICY IF EXISTS "team_details_insert_strict" ON public.team_member_details;
DROP POLICY IF EXISTS "team_details_select_strict" ON public.team_member_details;
DROP POLICY IF EXISTS "team_details_update_strict" ON public.team_member_details;

-- SELECT: own record, admin full, gerente/supervisor via hierarchy
CREATE POLICY "team_details_select" ON public.team_member_details
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin')
  OR (
    (has_role(auth.uid(), 'gerente') OR has_role(auth.uid(), 'supervisor'))
    AND user_id IN (SELECT subordinado_id FROM public.get_subordinados(auth.uid()))
  )
);

-- INSERT: own record, admin, or hierarchy manager
CREATE POLICY "team_details_insert" ON public.team_member_details
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin')
  OR (
    (has_role(auth.uid(), 'gerente') OR has_role(auth.uid(), 'supervisor'))
    AND user_id IN (SELECT subordinado_id FROM public.get_subordinados(auth.uid()))
  )
);

-- UPDATE: own record, admin, or hierarchy manager
CREATE POLICY "team_details_update" ON public.team_member_details
FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin')
  OR (
    (has_role(auth.uid(), 'gerente') OR has_role(auth.uid(), 'supervisor'))
    AND user_id IN (SELECT subordinado_id FROM public.get_subordinados(auth.uid()))
  )
)
WITH CHECK (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin')
  OR (
    (has_role(auth.uid(), 'gerente') OR has_role(auth.uid(), 'supervisor'))
    AND user_id IN (SELECT subordinado_id FROM public.get_subordinados(auth.uid()))
  )
);

-- DELETE: admin only
CREATE POLICY "team_details_delete" ON public.team_member_details
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Block anonymous access
CREATE POLICY "team_details_deny_anon" ON public.team_member_details
FOR ALL TO anon
USING (false)
WITH CHECK (false);

-- ============================================================
-- Fix 2: Update can_view_profile to use recursive hierarchy
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_view_profile(viewer_id uuid, target_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF viewer_id = target_profile_id THEN RETURN true; END IF;
  IF has_role(viewer_id, 'admin') THEN RETURN true; END IF;
  
  IF has_role(viewer_id, 'gerente') OR has_role(viewer_id, 'supervisor') THEN
    RETURN EXISTS (
      SELECT 1 FROM public.get_subordinados(viewer_id)
      WHERE subordinado_id = target_profile_id
    );
  END IF;
  
  RETURN false;
END;
$$;