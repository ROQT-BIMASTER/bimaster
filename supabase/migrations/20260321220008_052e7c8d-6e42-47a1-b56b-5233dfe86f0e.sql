INSERT INTO modulos_sistema (codigo, nome, descricao, ativo) VALUES
  ('central_inteligencia', 'Central de Inteligência', 'Dashboards analíticos de vendas', true),
  ('integracao_erp', 'Integração ERP', 'Portal de APIs e endpoints ERP', true)
ON CONFLICT (codigo) DO NOTHING;