-- Corrigir políticas de PHOTOS usando vendedor_id
DROP POLICY IF EXISTS "Usuários veem fotos permitidas" ON public.photos;
DROP POLICY IF EXISTS "Usuários gerenciam próprias fotos" ON public.photos;

CREATE POLICY "Usuários veem fotos permitidas" ON public.photos
FOR SELECT USING (
  vendedor_id = auth.uid() OR
  supervisor_id = auth.uid() OR
  is_admin_or_supervisor(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM visits v 
    WHERE v.id = photos.visit_id 
    AND (v.user_id = auth.uid() OR is_supervisor_of(auth.uid(), v.user_id))
  )
);

CREATE POLICY "Usuários gerenciam próprias fotos" ON public.photos
FOR ALL USING (
  vendedor_id = auth.uid() OR 
  supervisor_id = auth.uid() OR
  is_admin_or_supervisor(auth.uid())
);