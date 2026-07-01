DROP POLICY IF EXISTS "Mensagens: herdam visibilidade do briefing" ON public.briefing_mensagens;

CREATE POLICY "Mensagens: herdam visibilidade do briefing"
ON public.briefing_mensagens
FOR SELECT
TO authenticated
USING (public.can_access_briefing(briefing_id, auth.uid()));