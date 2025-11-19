-- =====================================================
-- FASE 1: REORGANIZAÇÃO DO BANCO DE DADOS
-- =====================================================

-- 1.1 - VINCULAR TELAS ÓRFÃS AOS MÓDULOS CORRETOS
-- =====================================================

-- Vincular telas antigas do módulo PROSPECTS
UPDATE telas_sistema 
SET modulo_codigo = 'PROSPECTS' 
WHERE codigo IN ('prospects', 'kanban', 'mapa', 'atividades', 'municipios')
AND ativo = true;

-- Vincular telas antigas do módulo TRADE
UPDATE telas_sistema 
SET modulo_codigo = 'TRADE' 
WHERE codigo IN (
  'trade_marketing', 'trade_stores', 'trade_visits', 'trade_photos', 
  'trade_promotions', 'trade_competitors', 'trade_insights', 'trade_import_stores'
)
AND ativo = true;

-- 1.2 - DELETAR MÓDULOS DUPLICADOS
-- =====================================================

-- Remover módulos antigos duplicados (manter apenas os MAIÚSCULOS)
DELETE FROM modulos_sistema 
WHERE codigo IN ('prospects', 'trade', 'relatorios')
AND ordem BETWEEN 2 AND 4;

-- Atualizar ordem dos módulos restantes para sequência limpa
UPDATE modulos_sistema SET ordem = 10 WHERE codigo = 'dashboard';
UPDATE modulos_sistema SET ordem = 20 WHERE codigo = 'PROSPECTS';
UPDATE modulos_sistema SET ordem = 30 WHERE codigo = 'MARKETING';
UPDATE modulos_sistema SET ordem = 40 WHERE codigo = 'TRADE';
UPDATE modulos_sistema SET ordem = 50 WHERE codigo = 'RELATORIOS';
UPDATE modulos_sistema SET ordem = 60 WHERE codigo = 'configuracoes';

-- 1.3 - PADRONIZAR ROTAS DAS TELAS ANTIGAS
-- =====================================================

-- Rotas antigas do PROSPECTS
UPDATE telas_sistema SET rota = '/dashboard/prospects' WHERE codigo = 'prospects';
UPDATE telas_sistema SET rota = '/dashboard/prospects/kanban' WHERE codigo = 'kanban';
UPDATE telas_sistema SET rota = '/dashboard/prospects/mapa' WHERE codigo = 'mapa';
UPDATE telas_sistema SET rota = '/dashboard/prospects/atividades' WHERE codigo = 'atividades';
UPDATE telas_sistema SET rota = '/dashboard/prospects/municipios' WHERE codigo = 'municipios';

-- Rotas antigas do TRADE
UPDATE telas_sistema SET rota = '/dashboard/trade' WHERE codigo = 'trade_marketing';
UPDATE telas_sistema SET rota = '/dashboard/trade/stores' WHERE codigo = 'trade_stores';
UPDATE telas_sistema SET rota = '/dashboard/trade/visits' WHERE codigo = 'trade_visits';
UPDATE telas_sistema SET rota = '/dashboard/trade/photos' WHERE codigo = 'trade_photos';
UPDATE telas_sistema SET rota = '/dashboard/trade/promotions' WHERE codigo = 'trade_promotions';
UPDATE telas_sistema SET rota = '/dashboard/trade/competitors' WHERE codigo = 'trade_competitors';
UPDATE telas_sistema SET rota = '/dashboard/trade/insights' WHERE codigo = 'trade_insights';
UPDATE telas_sistema SET rota = '/dashboard/trade/import-stores' WHERE codigo = 'trade_import_stores';

-- 1.4 - PADRONIZAR ROTAS DAS TELAS NOVAS
-- =====================================================

-- Corrigir rotas do módulo MARKETING
UPDATE telas_sistema SET rota = '/dashboard/marketing' WHERE codigo = 'MARKETING_DASHBOARD';
UPDATE telas_sistema SET rota = '/dashboard/marketing/social' WHERE codigo = 'MARKETING_SOCIAL';
UPDATE telas_sistema SET rota = '/dashboard/marketing/whatsapp' WHERE codigo = 'MARKETING_WHATSAPP';

-- Corrigir rotas do módulo PROSPECTS (novas)
UPDATE telas_sistema SET rota = '/dashboard/prospects' WHERE codigo = 'PROSPECTS_DASHBOARD';
UPDATE telas_sistema SET rota = '/dashboard/prospects/kanban' WHERE codigo = 'PROSPECTS_KANBAN';
UPDATE telas_sistema SET rota = '/dashboard/prospects/mapa' WHERE codigo = 'PROSPECTS_MAPA';
UPDATE telas_sistema SET rota = '/dashboard/prospects/lista' WHERE codigo = 'PROSPECTS_LISTA';
UPDATE telas_sistema SET rota = '/dashboard/prospects/atividades' WHERE codigo = 'PROSPECTS_ATIVIDADES';
UPDATE telas_sistema SET rota = '/dashboard/prospects/municipios' WHERE codigo = 'PROSPECTS_MUNICIPIOS';

-- Corrigir rotas do módulo TRADE (novas)
UPDATE telas_sistema SET rota = '/dashboard/trade' WHERE codigo = 'TRADE_DASHBOARD';
UPDATE telas_sistema SET rota = '/dashboard/trade/stores' WHERE codigo = 'TRADE_LOJAS';
UPDATE telas_sistema SET rota = '/dashboard/trade/visits' WHERE codigo = 'TRADE_VISITAS';
UPDATE telas_sistema SET rota = '/dashboard/trade/photos' WHERE codigo = 'TRADE_FOTOS';
UPDATE telas_sistema SET rota = '/dashboard/trade/auditorias' WHERE codigo = 'TRADE_AUDITORIAS';
UPDATE telas_sistema SET rota = '/dashboard/trade/performance' WHERE codigo = 'TRADE_PERFORMANCE';

-- Corrigir rota do módulo RELATORIOS
UPDATE telas_sistema SET rota = '/dashboard/relatorios' WHERE codigo = 'RELATORIOS_DASHBOARD';