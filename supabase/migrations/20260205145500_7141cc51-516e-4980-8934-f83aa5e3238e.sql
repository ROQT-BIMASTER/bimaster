-- 1. Adicionar módulo Trade para Michele Silva
INSERT INTO usuario_permissoes_modulos (usuario_id, modulo_id)
SELECT 
  '9b55c37f-e2c4-4064-9c89-1838f4e482fc',
  id
FROM modulos_sistema
WHERE codigo = 'trade'
ON CONFLICT DO NOTHING;

-- 2. Adicionar telas do Trade para Michele (exceto admin/insights/competitors)
INSERT INTO usuario_permissoes_telas (usuario_id, tela_id)
SELECT 
  '9b55c37f-e2c4-4064-9c89-1838f4e482fc',
  id
FROM telas_sistema
WHERE codigo IN (
  'TRADE_DASHBOARD',
  'trade_marketing', 
  'trade_stores',
  'trade_visits',
  'trade_photos',
  'TRADE_PERFORMANCE',
  'TRADE_FOTOS',
  'TRADE_VISITAS',
  'TRADE_LOJAS',
  'TRADE_AUDITORIAS'
)
ON CONFLICT DO NOTHING;