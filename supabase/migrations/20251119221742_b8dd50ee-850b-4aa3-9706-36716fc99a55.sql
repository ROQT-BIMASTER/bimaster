-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Usuários com permissão fabrica podem criar matérias-primas" ON fabrica_materias_primas;
DROP POLICY IF EXISTS "Usuários podem criar matérias-primas" ON fabrica_materias_primas;

-- Criar política INSERT para matérias-primas
CREATE POLICY "Usuários com permissão fabrica podem criar matérias-primas"
ON fabrica_materias_primas
FOR INSERT
WITH CHECK (
  created_by = auth.uid() AND 
  (
    EXISTS (
      SELECT 1 
      FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' 
      AND upm.usuario_id = auth.uid()
    )
    OR is_admin_or_supervisor(auth.uid())
  )
);

-- Criar política SELECT para matérias-primas
CREATE POLICY "Usuários com permissão fabrica podem ver matérias-primas"
ON fabrica_materias_primas
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

-- Criar política UPDATE para matérias-primas
CREATE POLICY "Criadores e admins podem atualizar matérias-primas"
ON fabrica_materias_primas
FOR UPDATE
USING (
  created_by = auth.uid() OR is_admin_or_supervisor(auth.uid())
);

-- Criar política DELETE para matérias-primas
CREATE POLICY "Apenas admins podem deletar matérias-primas"
ON fabrica_materias_primas
FOR DELETE
USING (
  is_admin_or_supervisor(auth.uid())
);