
-- Remover módulo comercial das permissões padrão por role (exceto para individuais)
-- Admin tem bypass automático no código, não precisa da permissão explícita
-- Supervisor também não deve ter acesso automático ao comercial

-- Remover permissão do módulo comercial do role supervisor
DELETE FROM role_permissoes_modulos
WHERE role = 'supervisor'
AND modulo_id = (SELECT id FROM modulos_sistema WHERE codigo = 'comercial');

-- Remover permissões das telas comerciais do role supervisor  
DELETE FROM role_permissoes_telas
WHERE role = 'supervisor'
AND tela_id IN (SELECT id FROM telas_sistema WHERE codigo IN ('comercial_dashboard', 'comercial_lancamentos'));

-- Remover permissão do módulo comercial do role admin (ele tem bypass automático)
DELETE FROM role_permissoes_modulos
WHERE role = 'admin'
AND modulo_id = (SELECT id FROM modulos_sistema WHERE codigo = 'comercial');

-- Remover permissões das telas comerciais do role admin (ele tem bypass automático)
DELETE FROM role_permissoes_telas
WHERE role = 'admin'
AND tela_id IN (SELECT id FROM telas_sistema WHERE codigo IN ('comercial_dashboard', 'comercial_lancamentos'));

-- Garantir que Ricardo Flausino tem a permissão da tela comercial_dashboard também
INSERT INTO usuario_permissoes_telas (usuario_id, tela_id)
SELECT 
  'c04bb2dd-f625-42cc-80b7-2e3904f402da',
  id
FROM telas_sistema 
WHERE codigo = 'comercial_dashboard'
ON CONFLICT DO NOTHING;
