
INSERT INTO public.modulos_sistema (codigo, nome, descricao, icone, ordem, ativo)
VALUES ('fornecedor_vendas_result', 'Vendas Result Union', 'Agrupamento de telas de vendas Result Union no menu Comercial', 'Truck', 101, true)
ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome, descricao = EXCLUDED.descricao, icone = EXCLUDED.icone, ativo = true;

INSERT INTO public.sidebar_category_modules (category_id, module_code, label_override, icon_override, ordem, ativo)
SELECT scm.category_id, 'fornecedor_vendas_result', 'Vendas Result Union', 'Truck', scm.ordem + 1, true
FROM public.sidebar_category_modules scm
WHERE scm.module_code = 'fornecedor_vendas'
ON CONFLICT DO NOTHING;

INSERT INTO public.sidebar_menu_items (module_code, item_code, label, icon, route, ordem, ativo, screen_code)
VALUES
  ('fornecedor_vendas_result', 'forn_result_pedidos',  'Pedidos em andamento',        'ClipboardList', '/dashboard/fornecedor/pedidos-result',  1, true, NULL),
  ('fornecedor_vendas_result', 'forn_result_vendas',   'Análise de Vendas (Result)',  'BarChart3',     '/dashboard/fornecedor/vendas-result',   2, true, NULL),
  ('fornecedor_vendas_result', 'forn_result_produtos', 'Vendas por Produto (Result)', 'Package',       '/dashboard/fornecedor/produtos-result', 3, true, NULL)
ON CONFLICT (module_code, item_code) DO UPDATE SET label = EXCLUDED.label, icon = EXCLUDED.icon, route = EXCLUDED.route, ativo = true;
