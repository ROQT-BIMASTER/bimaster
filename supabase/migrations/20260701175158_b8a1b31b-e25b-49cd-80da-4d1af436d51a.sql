
DROP POLICY IF EXISTS coordenadores_manage ON public.coordenadores;

CREATE POLICY "coordenadores_read_authenticated"
ON public.coordenadores
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "coordenadores_write_admin_supervisor"
ON public.coordenadores
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'supervisor')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'supervisor')
);
