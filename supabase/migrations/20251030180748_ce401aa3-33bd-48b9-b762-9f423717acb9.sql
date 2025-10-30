-- Dropar políticas antigas de visits
DROP POLICY IF EXISTS "Usuários podem ver visitas relacionadas" ON public.visits;
DROP POLICY IF EXISTS "Usuários podem criar suas visitas" ON public.visits;
DROP POLICY IF EXISTS "Usuários podem atualizar suas visitas" ON public.visits;
DROP POLICY IF EXISTS "Admins podem deletar visitas" ON public.visits;

-- Criar políticas mais permissivas para visits
-- Usuários podem ver:
-- 1. Suas próprias visitas
-- 2. Visitas de lojas que eles criaram
-- 3. Admins e supervisores veem tudo
CREATE POLICY "Usuários podem ver visitas relacionadas"
ON public.visits
FOR SELECT
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM public.stores s 
    WHERE s.id = visits.store_id 
    AND s.created_by = auth.uid()
  )
  OR is_admin_or_supervisor(auth.uid())
);

-- Usuários podem criar suas próprias visitas
CREATE POLICY "Usuários podem criar suas visitas"
ON public.visits
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Usuários podem atualizar suas próprias visitas
CREATE POLICY "Usuários podem atualizar suas visitas"
ON public.visits
FOR UPDATE
USING (
  auth.uid() = user_id 
  OR is_admin_or_supervisor(auth.uid())
);

-- Apenas admins podem deletar visitas
CREATE POLICY "Admins podem deletar visitas"
ON public.visits
FOR DELETE
USING (is_admin_or_supervisor(auth.uid()));