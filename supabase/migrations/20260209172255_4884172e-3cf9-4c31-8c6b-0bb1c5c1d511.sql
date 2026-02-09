
-- Fix fabrica_markup_overrides: replace "always true" policies with proper access control
DROP POLICY IF EXISTS "Authenticated users can delete markup overrides" ON public.fabrica_markup_overrides;
DROP POLICY IF EXISTS "Authenticated users can insert markup overrides" ON public.fabrica_markup_overrides;
DROP POLICY IF EXISTS "Authenticated users can update markup overrides" ON public.fabrica_markup_overrides;

-- Only admins, supervisors, and users with fabrica module access can modify markup overrides
CREATE POLICY "markup_overrides_insert" ON public.fabrica_markup_overrides
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'supervisor'::app_role) 
    OR usuario_tem_acesso_modulo(auth.uid(), 'fabrica'::text)
  );

CREATE POLICY "markup_overrides_update" ON public.fabrica_markup_overrides
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'supervisor'::app_role) 
    OR usuario_tem_acesso_modulo(auth.uid(), 'fabrica'::text)
  );

CREATE POLICY "markup_overrides_delete" ON public.fabrica_markup_overrides
  FOR DELETE USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'supervisor'::app_role)
  );
