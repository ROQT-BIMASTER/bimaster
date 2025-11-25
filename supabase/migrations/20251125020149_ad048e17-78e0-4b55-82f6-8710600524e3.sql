-- Correção de políticas RLS para supervisores no Trade Marketing
-- Garante que supervisores tenham acesso total ao módulo Trade

-- 1. FOTOS: Supervisores podem criar fotos sem restrições de vendedor_id
DROP POLICY IF EXISTS "Vendedor e supervisor criam fotos" ON photos;
CREATE POLICY "Vendedor e supervisor criam fotos" 
ON photos FOR INSERT 
TO public
WITH CHECK (
  (vendedor_id = auth.uid() AND usuario_tem_acesso_loja(auth.uid(), store_id))
  OR 
  (is_admin_or_supervisor(auth.uid()))
);

-- 2. AUDITORIAS: Supervisores podem criar sem restrições
DROP POLICY IF EXISTS "Usuários podem criar auditorias" ON gondola_audits;
CREATE POLICY "Usuários podem criar auditorias" 
ON gondola_audits FOR INSERT 
TO authenticated
WITH CHECK (
  created_by = auth.uid() 
  OR 
  is_admin_or_supervisor(auth.uid())
);

-- 3. VISITAS: Supervisores podem criar visitas para qualquer loja
DROP POLICY IF EXISTS "Usuários podem criar visitas" ON visits;
CREATE POLICY "Usuários podem criar visitas" 
ON visits FOR INSERT 
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR
  is_admin_or_supervisor(auth.uid())
);

-- 4. SHELF SHARE: Supervisores podem criar registros
DROP POLICY IF EXISTS "Usuários podem criar registros de shelf share" ON shelf_share;
CREATE POLICY "Usuários podem criar registros de shelf share" 
ON shelf_share FOR INSERT 
TO authenticated
WITH CHECK (
  vendedor_id = auth.uid()
  OR
  is_admin_or_supervisor(auth.uid())
);

-- 5. LANÇAMENTOS FINANCEIROS: Simplificar criação para supervisores
DROP POLICY IF EXISTS "Apenas supervisores podem criar lançamentos" ON trade_financial_entries;
DROP POLICY IF EXISTS "Usuários podem criar lançamentos" ON trade_financial_entries;
DROP POLICY IF EXISTS "Usuários podem criar entradas financeiras" ON trade_financial_entries;

CREATE POLICY "Supervisores e vendedores podem criar lançamentos" 
ON trade_financial_entries FOR INSERT 
TO authenticated
WITH CHECK (
  created_by = auth.uid()
);

-- 6. INVESTIMENTOS: Supervisores podem criar investimentos
DROP POLICY IF EXISTS "Usuários podem criar investimentos" ON trade_investments;
CREATE POLICY "Usuários podem criar investimentos" 
ON trade_investments FOR INSERT 
TO authenticated
WITH CHECK (
  created_by = auth.uid()
);

-- Comentário final
COMMENT ON POLICY "Vendedor e supervisor criam fotos" ON photos IS 
'Permite que vendedores criem fotos de suas lojas e supervisores criem fotos de qualquer loja (acesso total ao Trade)';

COMMENT ON POLICY "Supervisores e vendedores podem criar lançamentos" ON trade_financial_entries IS
'Permite que qualquer usuário autenticado crie lançamentos financeiros, com aprovação posterior por supervisores/admins';