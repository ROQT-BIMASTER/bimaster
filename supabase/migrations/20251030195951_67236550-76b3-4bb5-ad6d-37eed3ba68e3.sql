-- Corrigir política RLS permissiva no store_sellout_items
-- Remove política insegura que permite inserção sem verificação
DROP POLICY IF EXISTS "Usuários podem criar itens de sell out" ON store_sellout_items;

-- Criar política segura que verifica acesso à loja
-- Usuários só podem inserir itens para lojas que eles têm acesso
CREATE POLICY "Users can insert sellout items for accessible stores"
  ON store_sellout_items 
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stores s
      WHERE s.id = store_sellout_items.store_id
      AND (
        s.created_by = auth.uid()  -- Dono da loja
        OR is_admin_or_supervisor(auth.uid())  -- Admin/Supervisor
        OR EXISTS (
          SELECT 1 FROM visits v
          WHERE v.store_id = s.id
          AND v.user_id = auth.uid()  -- Vendedor atribuído
        )
      )
    )
  );

-- Adicionar comentário explicativo
COMMENT ON POLICY "Users can insert sellout items for accessible stores" ON store_sellout_items IS 
  'Permite inserção apenas para lojas que o usuário criou, foi atribuído como vendedor, ou se é admin/supervisor';