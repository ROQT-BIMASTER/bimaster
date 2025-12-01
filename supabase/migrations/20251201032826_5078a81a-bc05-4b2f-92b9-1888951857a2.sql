-- Permitir que usuários com permissão no módulo fábrica gerenciem dados fiscais dos produtos
CREATE POLICY "Usuarios fabrica podem gerenciar dados fiscais"
ON public.fabrica_dados_fiscais_produto
AS PERMISSIVE
FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1
    FROM usuario_permissoes_modulos upm
    JOIN modulos_sistema ms ON ms.id = upm.modulo_id
    WHERE ms.codigo = 'fabrica'
      AND upm.usuario_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM usuario_permissoes_modulos upm
    JOIN modulos_sistema ms ON ms.id = upm.modulo_id
    WHERE ms.codigo = 'fabrica'
      AND upm.usuario_id = auth.uid()
  )
);