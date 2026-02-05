
-- Add dedicated SELECT policy for gerente role on visits table
-- This ensures gerentes can see visits of their subordinates (via recursive hierarchy)
-- even if the has_role caching doesn't propagate correctly in PostgREST
CREATE POLICY "visits_select_gerente"
ON public.visits
FOR SELECT
USING (
  has_role(auth.uid(), 'gerente'::app_role) 
  AND (
    user_id = auth.uid()
    OR user_id IN (
      SELECT subordinado_id FROM get_subordinados(auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM stores s
      WHERE s.id = visits.store_id
      AND s.supervisor_id = auth.uid()
    )
  )
);
