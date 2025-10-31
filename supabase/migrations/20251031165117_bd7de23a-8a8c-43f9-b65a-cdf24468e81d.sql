-- Remover políticas antigas restritivas
DROP POLICY IF EXISTS "Admin e supervisor veem todas fotos" ON photos;
DROP POLICY IF EXISTS "Vendedor vê fotos de suas lojas" ON photos;

-- Criar políticas permissivas que se combinam
CREATE POLICY "Admins e supervisores podem ver todas as fotos"
ON photos FOR SELECT
TO authenticated
USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Vendedores podem ver suas próprias fotos"
ON photos FOR SELECT
TO authenticated
USING (vendedor_id = auth.uid());

CREATE POLICY "Supervisores podem ver fotos de seus subordinados"
ON photos FOR SELECT
TO authenticated
USING (
  supervisor_id IS NOT NULL 
  AND is_supervisor_of(auth.uid(), vendedor_id)
);