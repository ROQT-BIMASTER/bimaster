-- Inserir telas de Trade Marketing no sistema de permissões
INSERT INTO public.telas_sistema (codigo, nome, descricao, rota, icone, ordem, ativo) VALUES
('trade_marketing', 'Trade Marketing', 'Dashboard principal de Trade Marketing', '/dashboard/trade-marketing', 'TrendingUp', 50, true),
('trade_stores', 'PDVs / Lojas', 'Gerenciamento de pontos de venda', '/dashboard/trade-marketing/stores', 'Store', 51, true),
('trade_visits', 'Visitas', 'Agendamento e registro de visitas', '/dashboard/trade-marketing/visits', 'Calendar', 52, true),
('trade_photos', 'Fotos', 'Galeria e análise de fotos', '/dashboard/trade-marketing/photos', 'Camera', 53, true),
('trade_promotions', 'Promoções', 'Gerenciamento de promoções', '/dashboard/trade-marketing/promotions', 'Tag', 54, true),
('trade_competitors', 'Concorrentes', 'Análise de concorrência', '/dashboard/trade-marketing/competitors', 'Users', 55, true),
('trade_insights', 'Insights IA', 'Análises e insights por IA', '/dashboard/trade-marketing/insights', 'Brain', 56, true)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  rota = EXCLUDED.rota,
  icone = EXCLUDED.icone,
  ordem = EXCLUDED.ordem,
  ativo = EXCLUDED.ativo;