-- Adicionar módulos faltantes
INSERT INTO modulos_sistema (codigo, nome, descricao, icone, ordem, ativo) VALUES 
  ('financeiro', 'Módulo Financeiro', 'Gestão financeira, DRE e contas', 'DollarSign', 5, true),
  ('precos', 'Tabelas de Preços', 'Gestão de tabelas de preços e aprovações', 'Receipt', 6, true)
ON CONFLICT (codigo) DO UPDATE SET ativo = true;

-- Configurar permissões por role para módulos existentes
-- Fábrica: apenas admin
INSERT INTO role_permissoes_modulos (modulo_id, role)
SELECT id, 'admin' FROM modulos_sistema WHERE codigo = 'fabrica'
ON CONFLICT DO NOTHING;

-- Marketing: admin e supervisor  
INSERT INTO role_permissoes_modulos (modulo_id, role)
SELECT id, 'admin' FROM modulos_sistema WHERE codigo = 'marketing'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissoes_modulos (modulo_id, role)
SELECT id, 'supervisor' FROM modulos_sistema WHERE codigo = 'marketing'
ON CONFLICT DO NOTHING;

-- Financeiro: apenas admin
INSERT INTO role_permissoes_modulos (modulo_id, role)
SELECT id, 'admin' FROM modulos_sistema WHERE codigo = 'financeiro'
ON CONFLICT DO NOTHING;

-- Tabelas de Preços: admin e supervisor
INSERT INTO role_permissoes_modulos (modulo_id, role)
SELECT id, 'admin' FROM modulos_sistema WHERE codigo = 'precos'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissoes_modulos (modulo_id, role)
SELECT id, 'supervisor' FROM modulos_sistema WHERE codigo = 'precos'
ON CONFLICT DO NOTHING;

-- Prospects: todos os roles comerciais
INSERT INTO role_permissoes_modulos (modulo_id, role)
SELECT id, 'supervisor' FROM modulos_sistema WHERE codigo = 'prospects'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissoes_modulos (modulo_id, role)
SELECT id, 'vendedor' FROM modulos_sistema WHERE codigo = 'prospects'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissoes_modulos (modulo_id, role)
SELECT id, 'promotor' FROM modulos_sistema WHERE codigo = 'prospects'
ON CONFLICT DO NOTHING;