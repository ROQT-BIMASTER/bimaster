-- =========================================
-- SISTEMA DE TABELAS DE PREÇO POR CNPJ
-- =========================================

-- 1. Criar tabela de vinculação usuário-CNPJ
CREATE TABLE IF NOT EXISTS user_cnpj (
  user_id UUID NOT NULL,
  cnpj VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (user_id, cnpj)
);

-- 2. Adicionar campos de CNPJ nas tabelas de preço
ALTER TABLE fabrica_tabelas_preco 
ADD COLUMN IF NOT EXISTS owner_cnpj VARCHAR(20),
ADD COLUMN IF NOT EXISTS visivel_para_cnpjs TEXT[]; -- Array de CNPJs que podem ver essa tabela

-- 3. Adicionar campo tipo em fabrica_produtos para diferenciar produtos
ALTER TABLE fabrica_produtos
ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) DEFAULT 'ACABADO',
ADD COLUMN IF NOT EXISTS formula_id UUID REFERENCES fabrica_formulas(id);

-- Adicionar constraint no tipo
ALTER TABLE fabrica_produtos
DROP CONSTRAINT IF EXISTS fabrica_produtos_tipo_check;

ALTER TABLE fabrica_produtos
ADD CONSTRAINT fabrica_produtos_tipo_check CHECK (tipo IN ('MP', 'INTER', 'ACABADO'));

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_tabelas_preco_owner_cnpj ON fabrica_tabelas_preco(owner_cnpj);
CREATE INDEX IF NOT EXISTS idx_user_cnpj_user_id ON user_cnpj(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cnpj_cnpj ON user_cnpj(cnpj);
CREATE INDEX IF NOT EXISTS idx_produtos_tipo ON fabrica_produtos(tipo);

-- 5. RLS para user_cnpj
ALTER TABLE user_cnpj ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver seus próprios CNPJs
CREATE POLICY "Usuários podem ver seus CNPJs"
  ON user_cnpj FOR SELECT
  USING (auth.uid() = user_id OR is_admin_or_supervisor(auth.uid()));

-- Apenas admins podem gerenciar CNPJs
CREATE POLICY "Admins podem gerenciar CNPJs"
  ON user_cnpj FOR ALL
  USING (is_admin_or_supervisor(auth.uid()));

-- 6. Atualizar RLS das tabelas de preço para considerar CNPJ
DROP POLICY IF EXISTS "Usuários com permissão fabrica veem tabelas de preço" ON fabrica_tabelas_preco;

CREATE POLICY "Usuários podem ver tabelas do seu CNPJ"
  ON fabrica_tabelas_preco FOR SELECT
  USING (
    is_admin_or_supervisor(auth.uid()) OR
    (owner_cnpj IS NULL) OR -- Tabelas sem CNPJ são visíveis por todos com permissão
    owner_cnpj IN (
      SELECT cnpj FROM user_cnpj WHERE user_id = auth.uid()
    ) OR
    auth.uid() IN (
      SELECT user_id FROM user_cnpj 
      WHERE cnpj = ANY(visivel_para_cnpjs)
    ) OR
    created_by = auth.uid()
  );

-- 7. Function helper para verificar acesso por CNPJ
CREATE OR REPLACE FUNCTION user_tem_acesso_cnpj(p_user_id UUID, p_cnpj VARCHAR)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_cnpj
    WHERE user_id = p_user_id AND cnpj = p_cnpj
  ) OR is_admin_or_supervisor(p_user_id);
END;
$$;

-- 8. Adicionar comentários para documentação
COMMENT ON TABLE user_cnpj IS 'Vincula usuários aos CNPJs que podem visualizar tabelas de preço';
COMMENT ON COLUMN fabrica_tabelas_preco.owner_cnpj IS 'CNPJ proprietário da tabela de preço';
COMMENT ON COLUMN fabrica_tabelas_preco.visivel_para_cnpjs IS 'Array de CNPJs adicionais que podem visualizar esta tabela';
COMMENT ON COLUMN fabrica_produtos.tipo IS 'Tipo do produto: MP (matéria-prima), INTER (intermediário), ACABADO (produto final)';
COMMENT ON COLUMN fabrica_produtos.formula_id IS 'Fórmula usada para fabricar este produto acabado';