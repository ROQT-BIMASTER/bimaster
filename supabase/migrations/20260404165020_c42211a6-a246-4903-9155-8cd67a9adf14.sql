-- Fix sync_logs: remove permissive SELECT that overrides blocking policies
DROP POLICY IF EXISTS "Authenticated users can read sync_logs" ON public.sync_logs;

-- Create admin-only SELECT
CREATE POLICY "Admin can read sync_logs"
  ON public.sync_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));