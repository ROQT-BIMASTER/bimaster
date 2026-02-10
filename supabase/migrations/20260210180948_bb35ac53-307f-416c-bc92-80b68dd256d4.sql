
-- Fix permissive INSERT policies
DROP POLICY "lead_activity_logs_insert" ON public.lead_activity_logs;
CREATE POLICY "lead_activity_logs_insert" ON public.lead_activity_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY "internal_tickets_insert" ON public.internal_tickets;
CREATE POLICY "internal_tickets_insert" ON public.internal_tickets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND criado_por = auth.uid());
