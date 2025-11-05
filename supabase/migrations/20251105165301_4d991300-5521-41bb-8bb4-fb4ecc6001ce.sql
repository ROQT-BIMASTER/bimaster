
-- Corrigir políticas RLS para permitir supervisores criarem registros

-- ====================================================================
-- PHOTOS - Permitir supervisor criar fotos
-- ====================================================================
DROP POLICY IF EXISTS "Vendedor cria fotos com seu ID" ON photos;

CREATE POLICY "Vendedor e supervisor criam fotos"
ON photos FOR INSERT
TO public
WITH CHECK (
  -- Vendedor cria com seu próprio ID
  (vendedor_id = auth.uid() AND usuario_tem_acesso_loja(auth.uid(), store_id))
  OR
  -- Supervisor pode criar fotos (será seu ID no vendedor_id)
  (is_admin_or_supervisor(auth.uid()) AND usuario_tem_acesso_loja(auth.uid(), store_id))
);

-- ====================================================================
-- SHELF MEASUREMENTS - Permitir supervisor criar medições
-- ====================================================================
DROP POLICY IF EXISTS "Vendedor cria medições com seu ID" ON shelf_measurements;

CREATE POLICY "Vendedor e supervisor criam medições"
ON shelf_measurements FOR INSERT
TO public
WITH CHECK (
  -- Vendedor cria com seu próprio ID
  (vendedor_id = auth.uid() AND usuario_tem_acesso_loja(auth.uid(), store_id))
  OR
  -- Supervisor pode criar medições (será seu ID no vendedor_id)
  (is_admin_or_supervisor(auth.uid()) AND usuario_tem_acesso_loja(auth.uid(), store_id))
);

-- ====================================================================
-- VISITS - Garantir que supervisor pode criar visitas
-- ====================================================================
-- Já existe política correta, mas vamos garantir que está limpa
DROP POLICY IF EXISTS "Usuários podem criar próprias visitas" ON visits;
DROP POLICY IF EXISTS "Usuários podem criar suas visitas" ON visits;
DROP POLICY IF EXISTS "Usuários podem criar visitas com vinculação" ON visits;

CREATE POLICY "Usuários autenticados criam visitas"
ON visits FOR INSERT
TO authenticated
WITH CHECK (
  -- Qualquer usuário autenticado pode criar visita com seu próprio user_id
  user_id = auth.uid()
);
