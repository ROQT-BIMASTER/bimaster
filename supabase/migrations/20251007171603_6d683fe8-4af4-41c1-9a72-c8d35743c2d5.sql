-- Atualizar rotas do sistema para nova estrutura modular

-- Atualizar rota do módulo de prospects
UPDATE public.telas_sistema 
SET rota = '/dashboard/prospects',
    nome = 'Prospects',
    descricao = 'Módulo de gestão de prospects'
WHERE codigo = 'prospects';

-- Atualizar rotas das sub-telas de prospects
UPDATE public.telas_sistema 
SET rota = '/dashboard/prospects/kanban'
WHERE codigo = 'kanban';

UPDATE public.telas_sistema 
SET rota = '/dashboard/prospects/atividades'
WHERE codigo = 'atividades';

UPDATE public.telas_sistema 
SET rota = '/dashboard/prospects/mapa'
WHERE codigo = 'mapa';

-- Atualizar rota do módulo de trade marketing
UPDATE public.telas_sistema 
SET rota = '/dashboard/trade',
    nome = 'Trade Marketing',
    descricao = 'Módulo de Trade Marketing'
WHERE codigo = 'trade_marketing';

-- Atualizar rotas das sub-telas de trade
UPDATE public.telas_sistema 
SET rota = '/dashboard/trade/stores'
WHERE codigo = 'trade_stores';

UPDATE public.telas_sistema 
SET rota = '/dashboard/trade/visits'
WHERE codigo = 'trade_visits';

UPDATE public.telas_sistema 
SET rota = '/dashboard/trade/photos'
WHERE codigo = 'trade_photos';

UPDATE public.telas_sistema 
SET rota = '/dashboard/trade/promotions'
WHERE codigo = 'trade_promotions';

UPDATE public.telas_sistema 
SET rota = '/dashboard/trade/competitors'
WHERE codigo = 'trade_competitors';

UPDATE public.telas_sistema 
SET rota = '/dashboard/trade/insights'
WHERE codigo = 'trade_insights';