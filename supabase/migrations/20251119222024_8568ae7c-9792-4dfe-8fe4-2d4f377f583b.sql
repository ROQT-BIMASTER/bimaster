-- Criar políticas RLS para fabrica_codigos_fornecedor

-- SELECT: Usuários com permissão fabrica podem ver códigos
CREATE POLICY "Usuários com permissão fabrica podem ver códigos fornecedor"
ON fabrica_codigos_fornecedor
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM usuario_permissoes_modulos upm
    JOIN modulos_sistema ms ON ms.id = upm.modulo_id
    WHERE ms.codigo = 'fabrica' 
    AND upm.usuario_id = auth.uid()
  )
  OR is_admin_or_supervisor(auth.uid())
);

-- INSERT: Usuários com permissão fabrica podem criar códigos
CREATE POLICY "Usuários com permissão fabrica podem criar códigos fornecedor"
ON fabrica_codigos_fornecedor
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM usuario_permissoes_modulos upm
    JOIN modulos_sistema ms ON ms.id = upm.modulo_id
    WHERE ms.codigo = 'fabrica' 
    AND upm.usuario_id = auth.uid()
  )
  OR is_admin_or_supervisor(auth.uid())
);

-- UPDATE: Admins e supervisores podem atualizar códigos
CREATE POLICY "Admins podem atualizar códigos fornecedor"
ON fabrica_codigos_fornecedor
FOR UPDATE
USING (
  is_admin_or_supervisor(auth.uid())
);

-- DELETE: Apenas admins podem deletar códigos
CREATE POLICY "Apenas admins podem deletar códigos fornecedor"
ON fabrica_codigos_fornecedor
FOR DELETE
USING (
  is_admin_or_supervisor(auth.uid())
);