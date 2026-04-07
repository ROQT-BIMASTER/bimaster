DROP POLICY IF EXISTS "Service role can insert classification logs" ON public.classification_auto_logs;

CREATE POLICY "Admins can insert classification logs"
  ON public.classification_auto_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'supervisor')
  );