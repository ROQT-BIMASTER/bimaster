
-- FIX 2: Restrict profiles self-update to prevent privilege escalation
-- Drop the permissive policy and recreate with column restrictions
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_update_own" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND departamento_id IS NOT DISTINCT FROM (SELECT p.departamento_id FROM public.profiles p WHERE p.id = auth.uid())
  AND aprovado IS NOT DISTINCT FROM (SELECT p.aprovado FROM public.profiles p WHERE p.id = auth.uid())
  AND supervisor_id IS NOT DISTINCT FROM (SELECT p.supervisor_id FROM public.profiles p WHERE p.id = auth.uid())
  AND gerente_id IS NOT DISTINCT FROM (SELECT p.gerente_id FROM public.profiles p WHERE p.id = auth.uid())
  AND status IS NOT DISTINCT FROM (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid())
);
