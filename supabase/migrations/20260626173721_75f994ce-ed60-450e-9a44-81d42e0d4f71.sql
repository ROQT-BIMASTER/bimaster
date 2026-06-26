
-- Novo módulo "alias" para agrupar as telas de vendas Futura no menu Comercial.
-- A permissão é herdada do módulo 'fornecedor' via alias no frontend.
INSERT INTO public.modulos_sistema (codigo, nome, descricao, icone, ordem, ativo, acesso_padrao)
VALUES ('fornecedor_vendas', 'Vendas Futura Fornecedor', 'Agrupamento de telas de vendas Futura no menu Comercial', 'Truck', 100, true, false)
ON CONFLICT (codigo) DO NOTHING;

-- Vincula o agrupamento à categoria Comercial & Vendas (ordem 3, após Prospects e Comercial)
INSERT INTO public.sidebar_category_modules (category_id, module_code, label_override, icon_override, ordem, ativo)
VALUES ('da461709-3ec3-4ac5-966c-af438ae1f762', 'fornecedor_vendas', 'Vendas Futura Fornecedor', 'Truck', 3, true)
ON CONFLICT DO NOTHING;

-- Itens de menu apontando para rotas existentes (+ nova lista de clientes)
INSERT INTO public.sidebar_menu_items (module_code, item_code, label, icon, route, ordem, ativo, screen_code)
VALUES
  ('fornecedor_vendas', 'forn_vendas_visao',    'Visão geral',          'LayoutDashboard', '/dashboard/fornecedor',          1, true, NULL),
  ('fornecedor_vendas', 'forn_vendas_analise',  'Análise de vendas',    'BarChart3',       '/dashboard/fornecedor/vendas',   2, true, 'fornecedor_vendas'),
  ('fornecedor_vendas', 'forn_vendas_pedidos',  'Pedidos em andamento', 'ClipboardList',   '/dashboard/fornecedor/pedidos',  3, true, NULL),
  ('fornecedor_vendas', 'forn_vendas_clientes', 'Clientes (histórico)', 'LineChart',       '/dashboard/fornecedor/clientes', 4, true, NULL)
ON CONFLICT DO NOTHING;
