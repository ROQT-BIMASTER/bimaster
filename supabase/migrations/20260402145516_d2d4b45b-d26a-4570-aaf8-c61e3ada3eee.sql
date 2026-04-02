
-- Drop overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can manage sync mappings" ON public.asana_sync_mappings;

-- Replace with scoped policies
CREATE POLICY "Authenticated users can view sync mappings"
  ON public.asana_sync_mappings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert sync mappings"
  ON public.asana_sync_mappings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.asana_sync_log
      WHERE started_by = auth.uid() AND status = 'running'
    )
  );

CREATE POLICY "Authenticated users can update sync mappings"
  ON public.asana_sync_mappings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.asana_sync_log
      WHERE started_by = auth.uid()
    )
  );
