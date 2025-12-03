-- Remover política antiga e criar uma nova mais adequada
DROP POLICY IF EXISTS "Usuários podem ver tabelas do seu CNPJ" ON fabrica_tabelas_preco;

-- Política de SELECT mais abrangente para admin/supervisor
CREATE POLICY "Admin e supervisor podem ver todas tabelas"
ON fabrica_tabelas_preco
FOR SELECT
TO authenticated
USING (
  is_admin_or_supervisor(auth.uid())
);

-- Política de SELECT para outros usuários (baseada em CNPJ)
CREATE POLICY "Usuários veem tabelas do seu CNPJ ou que criaram"
ON fabrica_tabelas_preco
FOR SELECT
TO authenticated
USING (
  NOT is_admin_or_supervisor(auth.uid())
  AND (
    owner_cnpj IS NULL
    OR owner_cnpj::text IN (SELECT cnpj FROM user_cnpj WHERE user_id = auth.uid())
    OR auth.uid() IN (SELECT user_id FROM user_cnpj WHERE cnpj::text = ANY(fabrica_tabelas_preco.visivel_para_cnpjs))
    OR created_by = auth.uid()
  )
);