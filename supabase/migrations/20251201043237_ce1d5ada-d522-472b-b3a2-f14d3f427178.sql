-- Adicionar colunas de aprovação na tabela de versões
ALTER TABLE fabrica_tabelas_preco_versoes
ADD COLUMN IF NOT EXISTS aprovado_por UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ;

-- Adicionar colunas de aprovação na tabela principal se não existirem
ALTER TABLE fabrica_tabelas_preco
ADD COLUMN IF NOT EXISTS aprovado_por UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ;

-- Comentários
COMMENT ON COLUMN fabrica_tabelas_preco_versoes.aprovado_por IS 'ID do usuário que aprovou esta versão';
COMMENT ON COLUMN fabrica_tabelas_preco_versoes.aprovado_em IS 'Data e hora da aprovação desta versão';
COMMENT ON COLUMN fabrica_tabelas_preco.aprovado_por IS 'ID do usuário que aprovou a tabela';
COMMENT ON COLUMN fabrica_tabelas_preco.aprovado_em IS 'Data e hora da aprovação da tabela';