
-- 1. Fix departamentos: restrict SELECT to authenticated users with relevant access
DROP POLICY IF EXISTS "dept_select" ON public.departamentos;
CREATE POLICY "dept_select" ON public.departamentos
  FOR SELECT TO authenticated
  USING (check_user_access(auth.uid()));

-- 2. Fix fabrica_custo_evidencias: restrict DELETE
DROP POLICY IF EXISTS "Authenticated users can delete cost evidence" ON public.fabrica_custo_evidencias;
CREATE POLICY "Authenticated users can delete cost evidence" ON public.fabrica_custo_evidencias
  FOR DELETE TO authenticated
  USING (can_access_fabrica(auth.uid()));

-- 3. Fix fabrica_revisao_requisitos: restrict UPDATE  
DROP POLICY IF EXISTS "Authenticated users can update requisitos" ON public.fabrica_revisao_requisitos;
CREATE POLICY "Authenticated users can update requisitos" ON public.fabrica_revisao_requisitos
  FOR UPDATE TO authenticated
  USING (can_access_fabrica(auth.uid()));
