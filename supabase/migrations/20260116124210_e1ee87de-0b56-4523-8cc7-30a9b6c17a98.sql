
-- ================================================================
-- CORREÇÃO DE PERFORMANCE: Políticas RLS otimizadas
-- Usando estrutura correta: usuario_permissoes_modulos.usuario_id e modulo_id
-- ================================================================

-- 1. FABRICA_PRODUTOS - Política SELECT otimizada
DROP POLICY IF EXISTS "fabrica_produtos_select_v3" ON public.fabrica_produtos;

CREATE POLICY "fabrica_produtos_select_final" ON public.fabrica_produtos
FOR SELECT TO authenticated
USING (
  -- Admin ou supervisor
  EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'supervisor')
  )
  OR
  -- Usuário com permissão ao módulo fabrica ou precos
  EXISTS (
    SELECT 1 FROM usuario_permissoes_modulos upm 
    JOIN modulos_sistema ms ON ms.id = upm.modulo_id
    WHERE upm.usuario_id = auth.uid() AND ms.codigo IN ('fabrica', 'precos')
  )
);

-- 2. FABRICA_TABELAS_PRECO - Política SELECT otimizada
DROP POLICY IF EXISTS "fabrica_tabelas_preco_select_v3" ON public.fabrica_tabelas_preco;

CREATE POLICY "fabrica_tabelas_preco_select_final" ON public.fabrica_tabelas_preco
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'supervisor')
  )
  OR
  EXISTS (
    SELECT 1 FROM usuario_permissoes_modulos upm 
    JOIN modulos_sistema ms ON ms.id = upm.modulo_id
    WHERE upm.usuario_id = auth.uid() AND ms.codigo IN ('fabrica', 'precos')
  )
  OR
  created_by = auth.uid()
  OR
  owner_cnpj IS NULL
  OR
  EXISTS (
    SELECT 1 FROM user_cnpj uc 
    WHERE uc.user_id = auth.uid() AND uc.cnpj::text = owner_cnpj::text
  )
);

-- 3. FABRICA_PRECOS_PRODUTOS - Política SELECT otimizada
DROP POLICY IF EXISTS "fabrica_precos_produtos_select_v3" ON public.fabrica_precos_produtos;

CREATE POLICY "fabrica_precos_produtos_select_final" ON public.fabrica_precos_produtos
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'supervisor')
  )
  OR
  EXISTS (
    SELECT 1 FROM usuario_permissoes_modulos upm 
    JOIN modulos_sistema ms ON ms.id = upm.modulo_id
    WHERE upm.usuario_id = auth.uid() AND ms.codigo IN ('fabrica', 'precos')
  )
);

-- 4. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_user_roles_lookup ON public.user_roles(user_id, role);
CREATE INDEX IF NOT EXISTS idx_usuario_permissoes_modulos_usuario ON public.usuario_permissoes_modulos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_modulos_sistema_codigo ON public.modulos_sistema(codigo);
