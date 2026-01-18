-- =====================================================
-- SISTEMA DE CONTROLE DE ACESSO POR TABELA DE PREÇO
-- =====================================================

-- 1. Criar tabela de permissões por tabela de preço
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_price_table_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tabela_id UUID NOT NULL REFERENCES fabrica_tabelas_preco(id) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT true,
  can_edit BOOLEAN DEFAULT false,
  can_approve BOOLEAN DEFAULT false,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  UNIQUE(user_id, tabela_id)
);

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_user_price_table_access_user ON public.user_price_table_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_price_table_access_tabela ON public.user_price_table_access(tabela_id);

-- 3. Habilitar RLS
ALTER TABLE public.user_price_table_access ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS para a tabela de permissões
-- Admins podem gerenciar todas as permissões
CREATE POLICY "user_price_table_access_admin_all"
ON public.user_price_table_access FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Usuários podem ver suas próprias permissões
CREATE POLICY "user_price_table_access_view_own"
ON public.user_price_table_access FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 5. Função para verificar acesso a tabela de preço
CREATE OR REPLACE FUNCTION public.user_can_access_price_table(
  _user_id UUID, 
  _tabela_id UUID,
  _permission_type TEXT DEFAULT 'view'
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Admin sempre tem acesso total
    has_role(_user_id, 'admin'::app_role)
    OR
    -- Supervisor tem acesso de visualização e edição
    (has_role(_user_id, 'supervisor'::app_role) AND _permission_type IN ('view', 'edit'))
    OR
    -- Verificar permissão específica na tabela de acesso
    EXISTS (
      SELECT 1 FROM user_price_table_access
      WHERE user_id = _user_id 
        AND tabela_id = _tabela_id
        AND (
          (_permission_type = 'view' AND can_view = true)
          OR (_permission_type = 'edit' AND can_edit = true)
          OR (_permission_type = 'approve' AND can_approve = true)
        )
    )
$$;

-- 6. Atualizar políticas de fabrica_precos_produtos para usar controle granular
DROP POLICY IF EXISTS "fabrica_precos_select_admin_supervisor" ON public.fabrica_precos_produtos;

CREATE POLICY "fabrica_precos_produtos_select_with_access"
ON public.fabrica_precos_produtos FOR SELECT
TO authenticated
USING (
  user_can_access_price_table(auth.uid(), tabela_id, 'view')
);

DROP POLICY IF EXISTS "fabrica_precos_insert_admin" ON public.fabrica_precos_produtos;

CREATE POLICY "fabrica_precos_produtos_insert_with_access"
ON public.fabrica_precos_produtos FOR INSERT
TO authenticated
WITH CHECK (
  user_can_access_price_table(auth.uid(), tabela_id, 'edit')
);

DROP POLICY IF EXISTS "fabrica_precos_update_admin" ON public.fabrica_precos_produtos;

CREATE POLICY "fabrica_precos_produtos_update_with_access"
ON public.fabrica_precos_produtos FOR UPDATE
TO authenticated
USING (
  user_can_access_price_table(auth.uid(), tabela_id, 'edit')
);

DROP POLICY IF EXISTS "fabrica_precos_delete_admin" ON public.fabrica_precos_produtos;

CREATE POLICY "fabrica_precos_produtos_delete_admin"
ON public.fabrica_precos_produtos FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
);

-- 7. Atualizar políticas de fabrica_tabelas_preco para usar controle granular
DROP POLICY IF EXISTS "fabrica_tabelas_preco_select" ON public.fabrica_tabelas_preco;

CREATE POLICY "fabrica_tabelas_preco_select_with_access"
ON public.fabrica_tabelas_preco FOR SELECT
TO authenticated
USING (
  user_can_access_price_table(auth.uid(), id, 'view')
);

-- 8. Política para aprovação (apenas quem tem can_approve ou admin)
CREATE OR REPLACE FUNCTION public.user_can_approve_price_table(_user_id UUID, _tabela_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    has_role(_user_id, 'admin'::app_role)
    OR
    EXISTS (
      SELECT 1 FROM user_price_table_access
      WHERE user_id = _user_id 
        AND tabela_id = _tabela_id
        AND can_approve = true
    )
$$;

-- 9. Comentários para documentação
COMMENT ON TABLE public.user_price_table_access IS 'Controle granular de acesso por tabela de preço';
COMMENT ON COLUMN public.user_price_table_access.can_view IS 'Pode visualizar a tabela de preço';
COMMENT ON COLUMN public.user_price_table_access.can_edit IS 'Pode editar valores na tabela de preço';
COMMENT ON COLUMN public.user_price_table_access.can_approve IS 'Pode aprovar/validar a tabela de preço';