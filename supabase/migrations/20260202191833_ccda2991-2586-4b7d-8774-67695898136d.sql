
-- Adicionar política para permitir que admins vejam permissões de qualquer usuário
-- (A política existente user_price_table_access_admin_all já cobre isso com 'ALL')
-- O problema pode ser que a política 'ALL' não cobre SELECT explicitamente

-- Vamos verificar e criar uma política SELECT específica para admins
DROP POLICY IF EXISTS "user_price_table_access_admin_select" ON user_price_table_access;

CREATE POLICY "user_price_table_access_admin_select"
ON user_price_table_access
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR user_id = auth.uid());
