-- Simplificar políticas RLS da tabela fabrica_produtos para permitir uso adequado

-- Drop das políticas existentes
DROP POLICY IF EXISTS "Usuários com permissão fabrica podem criar produtos" ON fabrica_produtos;
DROP POLICY IF EXISTS "Usuários com permissão fabrica podem ver produtos" ON fabrica_produtos;
DROP POLICY IF EXISTS "Criadores e admins podem atualizar produtos" ON fabrica_produtos;
DROP POLICY IF EXISTS "Apenas admins podem deletar produtos" ON fabrica_produtos;

-- Nova política de SELECT - todos usuários autenticados podem ver produtos
CREATE POLICY "Usuários autenticados podem ver produtos"
ON fabrica_produtos FOR SELECT
TO authenticated
USING (true);

-- Nova política de INSERT - todos usuários autenticados podem criar produtos
CREATE POLICY "Usuários autenticados podem criar produtos"
ON fabrica_produtos FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Nova política de UPDATE - criadores, admins e supervisores podem atualizar
CREATE POLICY "Criadores, admins e supervisores podem atualizar produtos"
ON fabrica_produtos FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid() OR 
  is_admin_or_supervisor(auth.uid())
)
WITH CHECK (
  created_by = auth.uid() OR 
  is_admin_or_supervisor(auth.uid())
);

-- Nova política de DELETE - apenas admins e supervisores podem deletar
CREATE POLICY "Admins e supervisores podem deletar produtos"
ON fabrica_produtos FOR DELETE
TO authenticated
USING (is_admin_or_supervisor(auth.uid()));