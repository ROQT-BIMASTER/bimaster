-- Adicionar campos de departamento na tabela de plano de contas
ALTER TABLE trade_chart_of_accounts 
ADD COLUMN departamento_id uuid REFERENCES departamentos(id),
ADD COLUMN departamento_definido_manualmente boolean DEFAULT false,
ADD COLUMN departamento_confianca numeric(3,2);

-- Criar índice para performance
CREATE INDEX idx_chart_of_accounts_departamento ON trade_chart_of_accounts(departamento_id);

-- Comentários
COMMENT ON COLUMN trade_chart_of_accounts.departamento_id IS 'Departamento ao qual a conta está vinculada';
COMMENT ON COLUMN trade_chart_of_accounts.departamento_definido_manualmente IS 'Se true, a IA não sobrescreve a escolha do usuário';
COMMENT ON COLUMN trade_chart_of_accounts.departamento_confianca IS 'Score de confiança da IA na classificação (0-1)';

-- Inserir departamentos padrão se ainda não existirem
INSERT INTO departamentos (nome, descricao, ativo) VALUES
  ('Tecnologia da Informação', 'Gestão de sistemas, infraestrutura e desenvolvimento', true),
  ('Marketing', 'Campanhas, publicidade e comunicação', true),
  ('Comercial', 'Vendas, trade marketing e relacionamento com clientes', true),
  ('Operações', 'Processos operacionais e produção', true),
  ('Logística', 'Armazenagem, transporte e distribuição', true),
  ('Financeiro', 'Controladoria, contabilidade e tesouraria', true),
  ('Recursos Humanos', 'Gestão de pessoas, recrutamento e treinamento', true),
  ('Administrativo', 'Suporte administrativo e facilities', true)
ON CONFLICT DO NOTHING;