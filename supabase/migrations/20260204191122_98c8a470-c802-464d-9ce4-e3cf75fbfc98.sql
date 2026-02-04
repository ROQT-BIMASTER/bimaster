
-- =====================================================
-- CORREÇÃO DE SEGURANÇA: Consolidação de Políticas RLS
-- =====================================================

-- 1. PROFILES: Função can_view_profile já está correta (só próprio, admin, subordinado direto)
-- A função já implementa a lógica correta, apenas atualizando o finding

-- 2. ADS_ACCOUNTS: Função can_access_ads_account já está correta
-- Só owner e admin podem acessar

-- 3. TRADE_INVESTMENTS: Remover políticas redundantes e consolidar

-- Remover todas as políticas existentes de trade_investments
DROP POLICY IF EXISTS "Admin deleta investimentos" ON trade_investments;
DROP POLICY IF EXISTS "Admin e supervisor veem todos investimentos" ON trade_investments;
DROP POLICY IF EXISTS "Admins can delete investments" ON trade_investments;
DROP POLICY IF EXISTS "Admins gerenciam investimentos RLS" ON trade_investments;
DROP POLICY IF EXISTS "Apenas admins e supervisores podem gerenciar investimentos" ON trade_investments;
DROP POLICY IF EXISTS "Apenas supervisores podem criar investimentos" ON trade_investments;
DROP POLICY IF EXISTS "Criadores e admins podem gerenciar investimentos" ON trade_investments;
DROP POLICY IF EXISTS "Trade and admins can insert investments" ON trade_investments;
DROP POLICY IF EXISTS "Trade and admins can update investments" ON trade_investments;
DROP POLICY IF EXISTS "Trade marketing and admins can view investments" ON trade_investments;
DROP POLICY IF EXISTS "Usuários podem criar investimentos" ON trade_investments;
DROP POLICY IF EXISTS "Vendedores e promotores veem próprios investimentos" ON trade_investments;

-- Bloquear acesso anônimo
CREATE POLICY "trade_investments_deny_anonymous"
  ON trade_investments
  FOR SELECT
  TO anon
  USING (false);

-- SELECT: Apenas admins, supervisores e usuários com módulo trade
CREATE POLICY "trade_investments_select_strict"
  ON trade_investments
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'supervisor'::app_role)
    OR created_by = auth.uid()
    OR usuario_tem_acesso_modulo(auth.uid(), 'trade'::text)
  );

-- INSERT: Apenas admins, supervisores e usuários com módulo trade
CREATE POLICY "trade_investments_insert_strict"
  ON trade_investments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'supervisor'::app_role)
    OR usuario_tem_acesso_modulo(auth.uid(), 'trade'::text))
    AND created_by = auth.uid()
  );

-- UPDATE: Apenas admins, supervisores e criador
CREATE POLICY "trade_investments_update_strict"
  ON trade_investments
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'supervisor'::app_role)
    OR created_by = auth.uid()
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'supervisor'::app_role)
    OR created_by = auth.uid()
  );

-- DELETE: Apenas admins
CREATE POLICY "trade_investments_delete_admin_only"
  ON trade_investments
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Adicionar comentários de segurança nas tabelas
COMMENT ON TABLE profiles IS 'Perfis de usuário - RLS restrito a próprio usuário, admin e supervisor direto';
COMMENT ON TABLE ads_accounts IS 'Contas de anúncios - RLS restrito a owner e admin. Credenciais criptografadas.';
COMMENT ON TABLE trade_investments IS 'Investimentos de trade - RLS consolidado: admin/supervisor/trade team para SELECT, admin-only para DELETE';

-- 5. Garantir que a view ads_accounts_safe não exponha credenciais
CREATE OR REPLACE VIEW ads_accounts_safe AS
SELECT 
  id,
  user_id,
  platform,
  account_id,
  account_name,
  is_active,
  sync_status,
  last_sync_at,
  created_at,
  updated_at
  -- credentials_encrypted NÃO incluído
FROM ads_accounts
WHERE can_access_ads_account(auth.uid(), user_id);
