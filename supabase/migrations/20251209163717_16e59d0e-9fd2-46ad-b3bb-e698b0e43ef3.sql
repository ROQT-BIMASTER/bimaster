-- Fix modulos_sistema: require authentication for reading
DROP POLICY IF EXISTS "Todos podem ver módulos ativos" ON public.modulos_sistema;
CREATE POLICY "Authenticated users can view active modules" ON public.modulos_sistema
FOR SELECT USING (
  auth.uid() IS NOT NULL AND ativo = true
);

-- Fix our_brands: require authentication for reading  
DROP POLICY IF EXISTS "Usuários autenticados podem ver marcas próprias" ON public.our_brands;
CREATE POLICY "Authenticated users can view active brands" ON public.our_brands
FOR SELECT USING (
  auth.uid() IS NOT NULL AND active = true
);