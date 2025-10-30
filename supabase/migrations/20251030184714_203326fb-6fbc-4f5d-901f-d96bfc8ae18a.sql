-- Adicionar vendedor_id e supervisor_id às tabelas de trade marketing

-- 1. trade_investments
ALTER TABLE trade_investments
ADD COLUMN IF NOT EXISTS vendedor_id uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS supervisor_id uuid REFERENCES profiles(id);

-- 2. store_products
ALTER TABLE store_products
ADD COLUMN IF NOT EXISTS vendedor_id uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS supervisor_id uuid REFERENCES profiles(id);

-- 3. shelf_measurements
ALTER TABLE shelf_measurements
ADD COLUMN IF NOT EXISTS vendedor_id uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS supervisor_id uuid REFERENCES profiles(id);

-- 4. photos
ALTER TABLE photos
ADD COLUMN IF NOT EXISTS vendedor_id uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS supervisor_id uuid REFERENCES profiles(id);

-- 5. competitor_intelligence
ALTER TABLE competitor_intelligence
ADD COLUMN IF NOT EXISTS vendedor_id uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS supervisor_id uuid REFERENCES profiles(id);

-- 6. promotion_execution
ALTER TABLE promotion_execution
ADD COLUMN IF NOT EXISTS vendedor_id uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS supervisor_id uuid REFERENCES profiles(id);

-- 7. shelf_share
ALTER TABLE shelf_share
ADD COLUMN IF NOT EXISTS vendedor_id uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS supervisor_id uuid REFERENCES profiles(id);

-- Atualizar RLS policies para trade_investments
DROP POLICY IF EXISTS "Apenas admins e supervisores gerenciam investimentos" ON trade_investments;
DROP POLICY IF EXISTS "Admins e supervisores podem deletar investimentos" ON trade_investments;
DROP POLICY IF EXISTS "Criadores podem atualizar investimentos" ON trade_investments;
DROP POLICY IF EXISTS "Usuários podem criar investimentos" ON trade_investments;
DROP POLICY IF EXISTS "Usuários podem ver investimentos de suas lojas" ON trade_investments;

CREATE POLICY "Admin e supervisor veem todos investimentos" ON trade_investments
FOR SELECT USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Vendedor vê investimentos de suas lojas" ON trade_investments
FOR SELECT USING (
  vendedor_id = auth.uid() OR
  (supervisor_id IS NOT NULL AND is_supervisor_of(supervisor_id, auth.uid()))
);

CREATE POLICY "Vendedor cria investimentos com seu ID" ON trade_investments
FOR INSERT WITH CHECK (
  vendedor_id = auth.uid() AND
  usuario_tem_acesso_loja(auth.uid(), store_id)
);

CREATE POLICY "Vendedor atualiza seus investimentos" ON trade_investments
FOR UPDATE USING (
  vendedor_id = auth.uid() OR
  is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "Admin deleta investimentos" ON trade_investments
FOR DELETE USING (is_admin_or_supervisor(auth.uid()));

-- Atualizar RLS policies para store_products
DROP POLICY IF EXISTS "Admins e supervisores gerenciam produtos de loja" ON store_products;
DROP POLICY IF EXISTS "Usuários autenticados podem ver produtos de loja" ON store_products;
DROP POLICY IF EXISTS "Usuários podem inserir produtos em suas lojas" ON store_products;

CREATE POLICY "Admin e supervisor veem todos produtos" ON store_products
FOR SELECT USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Vendedor vê produtos de suas lojas" ON store_products
FOR SELECT USING (
  vendedor_id = auth.uid() OR
  (supervisor_id IS NOT NULL AND is_supervisor_of(supervisor_id, auth.uid()))
);

CREATE POLICY "Vendedor cria produtos com seu ID" ON store_products
FOR INSERT WITH CHECK (
  vendedor_id = auth.uid() AND
  usuario_tem_acesso_loja(auth.uid(), store_id)
);

CREATE POLICY "Vendedor atualiza seus produtos" ON store_products
FOR UPDATE USING (
  vendedor_id = auth.uid() OR
  is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "Admin deleta produtos de loja" ON store_products
FOR DELETE USING (is_admin_or_supervisor(auth.uid()));

-- Atualizar RLS policies para shelf_measurements
DROP POLICY IF EXISTS "Admins podem deletar medições" ON shelf_measurements;
DROP POLICY IF EXISTS "Criadores podem atualizar suas medições" ON shelf_measurements;
DROP POLICY IF EXISTS "Usuários podem criar medições" ON shelf_measurements;
DROP POLICY IF EXISTS "Usuários podem ver próprias medições" ON shelf_measurements;

CREATE POLICY "Admin e supervisor veem todas medições" ON shelf_measurements
FOR SELECT USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Vendedor vê medições de suas lojas" ON shelf_measurements
FOR SELECT USING (
  vendedor_id = auth.uid() OR
  (supervisor_id IS NOT NULL AND is_supervisor_of(supervisor_id, auth.uid()))
);

CREATE POLICY "Vendedor cria medições com seu ID" ON shelf_measurements
FOR INSERT WITH CHECK (
  vendedor_id = auth.uid() AND
  usuario_tem_acesso_loja(auth.uid(), store_id)
);

CREATE POLICY "Vendedor atualiza suas medições" ON shelf_measurements
FOR UPDATE USING (
  vendedor_id = auth.uid() OR
  is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "Admin deleta medições" ON shelf_measurements
FOR DELETE USING (is_admin_or_supervisor(auth.uid()));

-- Atualizar RLS policies para photos
DROP POLICY IF EXISTS "Apenas admins podem deletar fotos" ON photos;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar fotos" ON photos;
DROP POLICY IF EXISTS "Usuários autenticados podem criar fotos" ON photos;
DROP POLICY IF EXISTS "Usuários autenticados podem ver fotos" ON photos;

CREATE POLICY "Admin e supervisor veem todas fotos" ON photos
FOR SELECT USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Vendedor vê fotos de suas lojas" ON photos
FOR SELECT USING (
  vendedor_id = auth.uid() OR
  (supervisor_id IS NOT NULL AND is_supervisor_of(supervisor_id, auth.uid()))
);

CREATE POLICY "Vendedor cria fotos com seu ID" ON photos
FOR INSERT WITH CHECK (
  vendedor_id = auth.uid() AND
  (store_id IS NULL OR usuario_tem_acesso_loja(auth.uid(), store_id))
);

CREATE POLICY "Vendedor atualiza suas fotos" ON photos
FOR UPDATE USING (
  vendedor_id = auth.uid() OR
  is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "Admin deleta fotos" ON photos
FOR DELETE USING (is_admin_or_supervisor(auth.uid()));

-- Atualizar RLS policies para competitor_intelligence
DROP POLICY IF EXISTS "Apenas admins e supervisores gerenciam inteligência competitiv" ON competitor_intelligence;
DROP POLICY IF EXISTS "Usuários autenticados podem registrar inteligência" ON competitor_intelligence;
DROP POLICY IF EXISTS "Usuários autenticados podem ver inteligência competitiva" ON competitor_intelligence;

CREATE POLICY "Admin e supervisor veem toda inteligência" ON competitor_intelligence
FOR SELECT USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Vendedor vê inteligência de suas lojas" ON competitor_intelligence
FOR SELECT USING (
  vendedor_id = auth.uid() OR
  (supervisor_id IS NOT NULL AND is_supervisor_of(supervisor_id, auth.uid()))
);

CREATE POLICY "Vendedor cria inteligência com seu ID" ON competitor_intelligence
FOR INSERT WITH CHECK (
  vendedor_id = auth.uid() AND
  (store_id IS NULL OR usuario_tem_acesso_loja(auth.uid(), store_id))
);

CREATE POLICY "Vendedor atualiza sua inteligência" ON competitor_intelligence
FOR UPDATE USING (
  vendedor_id = auth.uid() OR
  is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "Admin deleta inteligência" ON competitor_intelligence
FOR DELETE USING (is_admin_or_supervisor(auth.uid()));

-- Atualizar RLS policies para promotion_execution
DROP POLICY IF EXISTS "Apenas admins e supervisores gerenciam execuções" ON promotion_execution;
DROP POLICY IF EXISTS "Usuários podem registrar execuções" ON promotion_execution;
DROP POLICY IF EXISTS "Usuários podem ver execuções de promoção" ON promotion_execution;

CREATE POLICY "Admin e supervisor veem todas execuções" ON promotion_execution
FOR SELECT USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Vendedor vê execuções de suas lojas" ON promotion_execution
FOR SELECT USING (
  vendedor_id = auth.uid() OR
  (supervisor_id IS NOT NULL AND is_supervisor_of(supervisor_id, auth.uid()))
);

CREATE POLICY "Vendedor cria execuções com seu ID" ON promotion_execution
FOR INSERT WITH CHECK (
  vendedor_id = auth.uid() AND
  (store_id IS NULL OR usuario_tem_acesso_loja(auth.uid(), store_id))
);

CREATE POLICY "Vendedor atualiza suas execuções" ON promotion_execution
FOR UPDATE USING (
  vendedor_id = auth.uid() OR
  is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "Admin deleta execuções" ON promotion_execution
FOR DELETE USING (is_admin_or_supervisor(auth.uid()));

-- Atualizar RLS policies para shelf_share
DROP POLICY IF EXISTS "Apenas admins e supervisores gerenciam shelf share" ON shelf_share;
DROP POLICY IF EXISTS "Usuários autenticados podem registrar shelf share" ON shelf_share;
DROP POLICY IF EXISTS "Usuários autenticados podem ver shelf share" ON shelf_share;

CREATE POLICY "Admin e supervisor veem todo shelf share" ON shelf_share
FOR SELECT USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Vendedor vê shelf share de suas lojas" ON shelf_share
FOR SELECT USING (
  vendedor_id = auth.uid() OR
  (supervisor_id IS NOT NULL AND is_supervisor_of(supervisor_id, auth.uid()))
);

CREATE POLICY "Vendedor cria shelf share com seu ID" ON shelf_share
FOR INSERT WITH CHECK (
  vendedor_id = auth.uid() AND
  (store_id IS NULL OR usuario_tem_acesso_loja(auth.uid(), store_id))
);

CREATE POLICY "Vendedor atualiza seu shelf share" ON shelf_share
FOR UPDATE USING (
  vendedor_id = auth.uid() OR
  is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "Admin deleta shelf share" ON shelf_share
FOR DELETE USING (is_admin_or_supervisor(auth.uid()));