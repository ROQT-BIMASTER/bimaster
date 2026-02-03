-- Criar módulo comercial
INSERT INTO modulos_sistema (codigo, nome, descricao, icone, ativo, ordem)
VALUES ('comercial', 'Comercial', 'Gestão de lançamentos e estratégias comerciais', 'Briefcase', true, 45)
ON CONFLICT (codigo) DO NOTHING;

-- Criar telas do módulo comercial
INSERT INTO telas_sistema (codigo, nome, descricao, modulo_codigo, ativo, ordem, rota, icone)
VALUES 
  ('comercial_dashboard', 'Dashboard Comercial', 'Página principal do módulo comercial', 'comercial', true, 1, '/dashboard/comercial', 'Home'),
  ('comercial_lancamentos', 'Calendário de Lançamentos', 'Gestão de lançamentos de produtos', 'comercial', true, 2, '/dashboard/comercial/lancamentos', 'Rocket')
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  modulo_codigo = EXCLUDED.modulo_codigo,
  rota = EXCLUDED.rota;

-- Dar permissão ao admin para o novo módulo (usando subquery para obter o ID)
INSERT INTO role_permissoes_modulos (role, modulo_id)
SELECT 'admin'::app_role, id FROM modulos_sistema WHERE codigo = 'comercial'
ON CONFLICT DO NOTHING;

-- Dar permissão ao admin para as telas do módulo (usando subqueries)
INSERT INTO role_permissoes_telas (role, tela_id)
SELECT 'admin'::app_role, id FROM telas_sistema WHERE codigo = 'comercial_dashboard'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissoes_telas (role, tela_id)
SELECT 'admin'::app_role, id FROM telas_sistema WHERE codigo = 'comercial_lancamentos'
ON CONFLICT DO NOTHING;

-- Dar permissão de supervisor para o módulo comercial
INSERT INTO role_permissoes_modulos (role, modulo_id)
SELECT 'supervisor'::app_role, id FROM modulos_sistema WHERE codigo = 'comercial'
ON CONFLICT DO NOTHING;

-- Dar permissão de supervisor para as telas
INSERT INTO role_permissoes_telas (role, tela_id)
SELECT 'supervisor'::app_role, id FROM telas_sistema WHERE codigo = 'comercial_dashboard'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissoes_telas (role, tela_id)
SELECT 'supervisor'::app_role, id FROM telas_sistema WHERE codigo = 'comercial_lancamentos'
ON CONFLICT DO NOTHING;