
-- =============================================
-- 1. projeto_briefings: DROP 2 duplicate policies
-- =============================================
DROP POLICY IF EXISTS "Users can delete briefings" ON public.projeto_briefings;
DROP POLICY IF EXISTS "Users can insert briefings" ON public.projeto_briefings;

-- =============================================
-- 2. projeto_briefing_campos: Fix access (creator-only → project member)
-- =============================================
DROP POLICY IF EXISTS "Users can view briefing fields" ON public.projeto_briefing_campos;
DROP POLICY IF EXISTS "Users can insert briefing fields" ON public.projeto_briefing_campos;
DROP POLICY IF EXISTS "Users can delete briefing fields" ON public.projeto_briefing_campos;

CREATE POLICY "Members can view briefing fields"
  ON public.projeto_briefing_campos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projeto_briefings b
      WHERE b.id = projeto_briefing_campos.briefing_id
        AND public.user_can_access_projeto(auth.uid(), b.projeto_id)
    )
  );

CREATE POLICY "Members can insert briefing fields"
  ON public.projeto_briefing_campos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projeto_briefings b
      WHERE b.id = projeto_briefing_campos.briefing_id
        AND public.user_can_access_projeto(auth.uid(), b.projeto_id)
    )
  );

CREATE POLICY "Members can update briefing fields"
  ON public.projeto_briefing_campos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projeto_briefings b
      WHERE b.id = projeto_briefing_campos.briefing_id
        AND public.user_can_access_projeto(auth.uid(), b.projeto_id)
    )
  );

CREATE POLICY "Members can delete briefing fields"
  ON public.projeto_briefing_campos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projeto_briefings b
      WHERE b.id = projeto_briefing_campos.briefing_id
        AND public.user_can_access_projeto(auth.uid(), b.projeto_id)
    )
  );

-- =============================================
-- 3. projeto_tarefa_messages: ADD SELECT + DELETE
-- =============================================
CREATE POLICY "Members can view task messages"
  ON public.projeto_tarefa_messages FOR SELECT
  USING (
    public.user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id)
  );

CREATE POLICY "Authors can delete own messages"
  ON public.projeto_tarefa_messages FOR DELETE
  USING (auth.uid() = user_id);
