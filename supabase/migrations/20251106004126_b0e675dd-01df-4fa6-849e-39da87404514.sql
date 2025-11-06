
-- Adicionar validação de hierarquia nas visitas

-- ====================================================================
-- VISITS - Supervisores veem apenas visitas de subordinados
-- ====================================================================

-- Remover políticas antigas de SELECT
DROP POLICY IF EXISTS "Usuários podem ver visitas relacionadas" ON visits;
DROP POLICY IF EXISTS "Admin e supervisor veem todas visitas" ON visits;
DROP POLICY IF EXISTS "Usuários autenticados veem visitas" ON visits;

-- Admin vê tudo
CREATE POLICY "Admin vê todas visitas"
ON visits FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Supervisor vê apenas visitas de seus subordinados e próprias
CREATE POLICY "Supervisor vê visitas de subordinados"
ON visits FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'supervisor') AND (
    -- Suas próprias visitas
    user_id = auth.uid()
    OR
    -- Visitas de subordinados diretos e indiretos
    user_id IN (SELECT subordinado_id FROM get_subordinados(auth.uid()))
    OR
    -- Visitas de lojas onde ele é supervisor
    EXISTS (
      SELECT 1 FROM stores s
      WHERE s.id = visits.store_id
      AND s.supervisor_id = auth.uid()
    )
  )
);

-- Vendedor/Promotor vê apenas suas próprias visitas
CREATE POLICY "Vendedor vê suas visitas"
ON visits FOR SELECT
TO authenticated
USING (
  (has_role(auth.uid(), 'vendedor') OR has_role(auth.uid(), 'promotor'))
  AND user_id = auth.uid()
);
