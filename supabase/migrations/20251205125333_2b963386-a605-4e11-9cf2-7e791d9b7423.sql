-- Add RLS policies to departamentos table to restrict access to admin/supervisor only

-- Drop existing overly permissive policies if any
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.departamentos;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.departamentos;
DROP POLICY IF EXISTS "departamentos_select_policy" ON public.departamentos;

-- Ensure RLS is enabled
ALTER TABLE public.departamentos ENABLE ROW LEVEL SECURITY;

-- Create restrictive SELECT policy - only admin/supervisor can view department structure
CREATE POLICY "departamentos_select_admin_supervisor"
ON public.departamentos
FOR SELECT
TO authenticated
USING (
  public.is_admin_or_supervisor(auth.uid())
);

-- Create INSERT policy - only admin can create departments
CREATE POLICY "departamentos_insert_admin"
ON public.departamentos
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
);

-- Create UPDATE policy - only admin can update departments
CREATE POLICY "departamentos_update_admin"
ON public.departamentos
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create DELETE policy - only admin can delete departments
CREATE POLICY "departamentos_delete_admin"
ON public.departamentos
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));