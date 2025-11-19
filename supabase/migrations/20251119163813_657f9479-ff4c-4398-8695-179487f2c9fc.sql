
-- Criar os módulos do sistema
INSERT INTO modulos_sistema (codigo, nome, descricao, icone, ordem, ativo) VALUES
  ('prospects', 'Módulo de Prospects', 'Gestão completa de prospects e pipeline de vendas', 'Users', 1, true),
  ('marketing', 'Módulo de Marketing', 'Dashboards, redes sociais e WhatsApp', 'BarChart3', 2, true),
  ('trade', 'Trade Marketing', 'Gestão de PDVs, visitas, fotos e auditoria de gôndola', 'Store', 3, true)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  icone = EXCLUDED.icone,
  ordem = EXCLUDED.ordem,
  ativo = EXCLUDED.ativo;

-- Garantir que admins têm acesso a todos os módulos
INSERT INTO role_permissoes_modulos (role, modulo_id)
SELECT 'admin', id FROM modulos_sistema WHERE codigo IN ('prospects', 'marketing', 'trade')
ON CONFLICT DO NOTHING;

-- Garantir que supervisores também têm acesso
INSERT INTO role_permissoes_modulos (role, modulo_id)
SELECT 'supervisor', id FROM modulos_sistema WHERE codigo IN ('prospects', 'marketing', 'trade')
ON CONFLICT DO NOTHING;

-- Garantir que vendedores têm acesso
INSERT INTO role_permissoes_modulos (role, modulo_id)
SELECT 'vendedor', id FROM modulos_sistema WHERE codigo IN ('prospects', 'marketing', 'trade')
ON CONFLICT DO NOTHING;

-- Garantir que promotores têm acesso ao trade
INSERT INTO role_permissoes_modulos (role, modulo_id)
SELECT 'promotor', id FROM modulos_sistema WHERE codigo = 'trade'
ON CONFLICT DO NOTHING;
