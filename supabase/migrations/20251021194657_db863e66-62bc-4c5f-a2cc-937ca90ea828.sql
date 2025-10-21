-- Atualizar RLS policies para trade_financial_entries
-- Apenas supervisores e admins podem criar lançamentos
DROP POLICY IF EXISTS "Usuários autenticados podem criar lançamentos" ON trade_financial_entries;

CREATE POLICY "Apenas supervisores podem criar lançamentos"
ON trade_financial_entries
FOR INSERT
TO authenticated
WITH CHECK (
  is_admin_or_supervisor(auth.uid()) AND created_by = auth.uid()
);

-- Política para visualizar: criador pode ver seus próprios, aprovador pode ver que aprovou, admins/supervisores veem tudo
DROP POLICY IF EXISTS "Usuários podem ver próprios lançamentos" ON trade_financial_entries;

CREATE POLICY "Usuários veem lançamentos relacionados a eles"
ON trade_financial_entries
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid() 
  OR approved_by = auth.uid() 
  OR is_admin_or_supervisor(auth.uid())
);

-- Atualizar RLS policies para trade_investments
-- Apenas supervisores e admins podem criar investimentos
DROP POLICY IF EXISTS "Usuários podem criar investimentos" ON trade_investments;

CREATE POLICY "Apenas supervisores podem criar investimentos"
ON trade_investments
FOR INSERT
TO authenticated
WITH CHECK (
  is_admin_or_supervisor(auth.uid()) AND created_by = auth.uid()
);

-- Política de visualização para investimentos
DROP POLICY IF EXISTS "Usuários podem ver próprios investimentos" ON trade_investments;

CREATE POLICY "Usuários veem investimentos relacionados a eles"
ON trade_investments
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid() 
  OR approved_by = auth.uid() 
  OR is_admin_or_supervisor(auth.uid())
);