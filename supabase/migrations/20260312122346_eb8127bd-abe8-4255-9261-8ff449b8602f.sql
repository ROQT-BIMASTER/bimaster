-- Allow supervisors and gerentes to upload avatars for their team members
DROP POLICY IF EXISTS "Supervisors can upload team member avatars" ON storage.objects;
CREATE POLICY "Supervisors can upload team member avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente'::public.app_role)
  )
);

-- Allow supervisors and gerentes to update team member avatars
DROP POLICY IF EXISTS "Supervisors can update team member avatars" ON storage.objects;
CREATE POLICY "Supervisors can update team member avatars"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente'::public.app_role)
  )
);

-- Allow supervisors and gerentes to delete team member avatars
DROP POLICY IF EXISTS "Supervisors can delete team member avatars" ON storage.objects;
CREATE POLICY "Supervisors can delete team member avatars"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente'::public.app_role)
  )
);