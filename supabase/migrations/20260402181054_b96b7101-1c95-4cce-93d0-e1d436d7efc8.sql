
-- =============================================
-- 1. Fix projeto_briefings RLS
-- =============================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Users can read briefings" ON public.projeto_briefings;
DROP POLICY IF EXISTS "Users can update briefings" ON public.projeto_briefings;
DROP POLICY IF EXISTS "Users can view briefings of their projects" ON public.projeto_briefings;
DROP POLICY IF EXISTS "Authenticated users can insert projeto_briefings" ON public.projeto_briefings;

-- Create proper policies
CREATE POLICY "Members can view project briefings" ON public.projeto_briefings
  FOR SELECT TO authenticated
  USING (public.user_can_access_projeto(auth.uid(), projeto_id));

CREATE POLICY "Members can update project briefings" ON public.projeto_briefings
  FOR UPDATE TO authenticated
  USING (public.user_can_access_projeto(auth.uid(), projeto_id));

-- =============================================
-- 2. Fix projeto_atividades RLS
-- =============================================

DROP POLICY IF EXISTS "Authenticated users can view projeto_atividades" ON public.projeto_atividades;
DROP POLICY IF EXISTS "Authenticated users can update projeto_atividades" ON public.projeto_atividades;
DROP POLICY IF EXISTS "Authenticated users can insert projeto_atividades" ON public.projeto_atividades;

CREATE POLICY "Members can view project activities" ON public.projeto_atividades
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projeto_tarefas pt
      WHERE pt.id = projeto_atividades.tarefa_id
      AND public.user_can_access_projeto(auth.uid(), pt.projeto_id)
    )
  );

CREATE POLICY "Members can insert project activities" ON public.projeto_atividades
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projeto_tarefas pt
      WHERE pt.id = projeto_atividades.tarefa_id
      AND public.user_can_access_projeto(auth.uid(), pt.projeto_id)
    )
  );

CREATE POLICY "Members can update project activities" ON public.projeto_atividades
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projeto_tarefas pt
      WHERE pt.id = projeto_atividades.tarefa_id
      AND public.user_can_access_projeto(auth.uid(), pt.projeto_id)
    )
  );

-- =============================================
-- 3. Fix projeto_calendario_regras RLS
-- =============================================

DROP POLICY IF EXISTS "Authenticated users can manage regras" ON public.projeto_calendario_regras;

CREATE POLICY "Members can view calendar rules" ON public.projeto_calendario_regras
  FOR SELECT TO authenticated
  USING (public.user_can_access_projeto(auth.uid(), projeto_id));

CREATE POLICY "Members can insert calendar rules" ON public.projeto_calendario_regras
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_projeto(auth.uid(), projeto_id));

CREATE POLICY "Members can update calendar rules" ON public.projeto_calendario_regras
  FOR UPDATE TO authenticated
  USING (public.user_can_access_projeto(auth.uid(), projeto_id));

CREATE POLICY "Members can delete calendar rules" ON public.projeto_calendario_regras
  FOR DELETE TO authenticated
  USING (public.user_can_access_projeto(auth.uid(), projeto_id));

-- =============================================
-- 4. RPC for project metrics (avoid 1000-row limit)
-- =============================================

CREATE OR REPLACE FUNCTION public.get_projeto_metrics()
RETURNS TABLE(projeto_id uuid, total_tarefas bigint, concluidas bigint, atrasadas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    pt.projeto_id,
    COUNT(*)::bigint AS total_tarefas,
    COUNT(*) FILTER (WHERE pt.status = 'concluida')::bigint AS concluidas,
    COUNT(*) FILTER (WHERE pt.status != 'concluida' AND pt.data_prazo IS NOT NULL AND pt.data_prazo::date < CURRENT_DATE)::bigint AS atrasadas
  FROM public.projeto_tarefas pt
  WHERE pt.excluida_em IS NULL
  GROUP BY pt.projeto_id
$$;
