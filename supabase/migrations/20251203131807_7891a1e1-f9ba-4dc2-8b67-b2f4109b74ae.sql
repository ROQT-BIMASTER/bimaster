-- Adicionar permissões de supervisor para TODAS as telas do Trade
INSERT INTO role_permissoes_telas (tela_id, role)
SELECT id, 'supervisor'::app_role FROM telas_sistema WHERE codigo LIKE 'trade%' AND ativo = true
ON CONFLICT DO NOTHING;

-- Garantir que vendedor e promotor também tenham acesso às telas básicas do Trade
INSERT INTO role_permissoes_telas (tela_id, role)
SELECT id, 'vendedor'::app_role FROM telas_sistema 
WHERE codigo IN ('trade_marketing', 'trade_stores', 'trade_visits', 'trade_photos', 'trade_promotions') 
AND ativo = true
ON CONFLICT DO NOTHING;

INSERT INTO role_permissoes_telas (tela_id, role)
SELECT id, 'promotor'::app_role FROM telas_sistema 
WHERE codigo IN ('trade_marketing', 'trade_stores', 'trade_visits', 'trade_photos') 
AND ativo = true
ON CONFLICT DO NOTHING;