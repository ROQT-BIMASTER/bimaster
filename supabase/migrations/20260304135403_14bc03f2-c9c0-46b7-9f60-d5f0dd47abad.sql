
-- Drop the blocking SELECT policy
DROP POLICY IF EXISTS "fabrica_fornecedores_no_direct_select" ON public.fabrica_fornecedores;

-- Create a proper SELECT policy for authenticated users with fabrica access
CREATE POLICY "Authenticated users can select suppliers"
ON public.fabrica_fornecedores
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'supervisor'::app_role) 
  OR usuario_tem_acesso_modulo(auth.uid(), 'fabrica'::text)
);
