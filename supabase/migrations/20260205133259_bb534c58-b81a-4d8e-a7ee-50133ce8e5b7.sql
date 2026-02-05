-- =====================================================
-- IMPLEMENTAÇÃO DE VÍNCULO MULTI-FILIAL PARA DESPESAS
-- =====================================================

-- 1. Criar tabela de empresas centralizada
CREATE TABLE IF NOT EXISTS empresas (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  cnpj VARCHAR(18),
  uf VARCHAR(2),
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

-- Política de leitura para empresas (todos autenticados podem ver)
DROP POLICY IF EXISTS "empresas_select_policy" ON empresas;
CREATE POLICY "empresas_select_policy" ON empresas
FOR SELECT TO authenticated USING (true);

-- Política de escrita apenas para admins (usando user_roles)
DROP POLICY IF EXISTS "empresas_admin_policy" ON empresas;
CREATE POLICY "empresas_admin_policy" ON empresas
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'supervisor')
  )
);

-- Popular com dados existentes de contas_pagar
INSERT INTO empresas (id, nome)
SELECT DISTINCT empresa_id, empresa_nome 
FROM contas_pagar 
WHERE empresa_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Garantir que a sequência está correta
SELECT setval('empresas_id_seq', COALESCE((SELECT MAX(id) FROM empresas), 1));

-- 2. Criar tabela de vínculo usuário-empresa (N:N)
CREATE TABLE IF NOT EXISTS user_empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, empresa_id)
);

-- Habilitar RLS
ALTER TABLE user_empresas ENABLE ROW LEVEL SECURITY;

-- Política de leitura (usuário vê seus vínculos, admin vê todos)
DROP POLICY IF EXISTS "user_empresas_select_policy" ON user_empresas;
CREATE POLICY "user_empresas_select_policy" ON user_empresas
FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'supervisor')
  )
);

-- Política de escrita apenas para admins
DROP POLICY IF EXISTS "user_empresas_admin_policy" ON user_empresas;
CREATE POLICY "user_empresas_admin_policy" ON user_empresas
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'supervisor')
  )
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_empresas_user_id ON user_empresas(user_id);
CREATE INDEX IF NOT EXISTS idx_user_empresas_empresa_id ON user_empresas(empresa_id);

-- 3. Adicionar colunas empresa_id nas tabelas de despesas

-- department_expenses
ALTER TABLE department_expenses 
ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id);

ALTER TABLE department_expenses 
ADD COLUMN IF NOT EXISTS empresa_nome VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_department_expenses_empresa_id 
ON department_expenses(empresa_id);

-- financial_payment_queue
ALTER TABLE financial_payment_queue 
ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id);

ALTER TABLE financial_payment_queue 
ADD COLUMN IF NOT EXISTS empresa_nome VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_financial_payment_queue_empresa_id 
ON financial_payment_queue(empresa_id);

-- 4. Criar funções de segurança

-- Função para verificar se usuário é admin ou supervisor (usando user_roles)
CREATE OR REPLACE FUNCTION is_admin_or_supervisor(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = _user_id 
    AND role IN ('admin', 'supervisor')
  )
$$;

-- Função para obter IDs das empresas do usuário
CREATE OR REPLACE FUNCTION get_user_empresa_ids(_user_id UUID)
RETURNS INTEGER[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    ARRAY(SELECT empresa_id FROM user_empresas WHERE user_id = _user_id),
    ARRAY[]::INTEGER[]
  )
$$;

-- Função para verificar acesso à empresa
CREATE OR REPLACE FUNCTION user_has_empresa_access(_user_id UUID, _empresa_id INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Se empresa_id é null, permite (dados legados)
    _empresa_id IS NULL OR
    -- Admin/Supervisor vê tudo
    is_admin_or_supervisor(_user_id) OR
    -- Usuário tem vínculo com a empresa
    EXISTS (
      SELECT 1 FROM user_empresas 
      WHERE user_id = _user_id AND empresa_id = _empresa_id
    )
$$;

-- 5. Atualizar políticas RLS para department_expenses

-- Remover políticas existentes
DROP POLICY IF EXISTS "Allow users to view department expenses" ON department_expenses;
DROP POLICY IF EXISTS "dep_expenses_select_policy" ON department_expenses;

-- Nova política de leitura com filtro de empresa
CREATE POLICY "dep_expenses_select_policy" ON department_expenses
FOR SELECT TO authenticated USING (
  -- Criador vê suas despesas
  created_by = auth.uid() OR
  -- Gestor do departamento vê despesas do departamento
  EXISTS (
    SELECT 1 FROM departamentos d
    WHERE d.id = department_expenses.department_id 
    AND d.responsavel_id = auth.uid()
  ) OR
  -- Financeiro vê tudo
  can_access_payment_queue(auth.uid()) OR
  -- Admin/Supervisor vê tudo
  is_admin_or_supervisor(auth.uid()) OR
  -- Usuário com acesso à empresa vê despesas da empresa
  user_has_empresa_access(auth.uid(), empresa_id)
);

-- 6. Atualizar políticas RLS para financial_payment_queue

-- Remover política existente
DROP POLICY IF EXISTS "fpq_select_policy" ON financial_payment_queue;

-- Nova política com filtro de empresa
CREATE POLICY "fpq_select_policy" ON financial_payment_queue
FOR SELECT TO authenticated USING (
  -- Financeiro/Tesouraria/Controladoria veem tudo
  can_access_payment_queue(auth.uid()) OR
  -- Solicitante vê suas solicitações
  requested_by = auth.uid() OR
  -- Admin/Supervisor vê tudo
  is_admin_or_supervisor(auth.uid()) OR
  -- Usuário com acesso à empresa vê solicitações da empresa
  user_has_empresa_access(auth.uid(), empresa_id)
);