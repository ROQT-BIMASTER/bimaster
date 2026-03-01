
-- Allow authenticated users to insert their own page_view logs
CREATE POLICY "Users can insert their own access logs"
ON public.access_audit_log
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow admins to read all access logs (for monitoring panel)
CREATE POLICY "Admins can read all access logs"
ON public.access_audit_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
