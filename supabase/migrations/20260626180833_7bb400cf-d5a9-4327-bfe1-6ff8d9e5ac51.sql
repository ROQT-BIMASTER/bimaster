
INSERT INTO public.sidebar_menu_items (module_code, item_code, label, icon, route, ordem, ativo, screen_code)
SELECT 'fornecedor_vendas', 'fornecedor_produtos', 'Vendas por produto', 'Package', '/dashboard/fornecedor/produtos',
       COALESCE((SELECT MAX(ordem) FROM public.sidebar_menu_items WHERE module_code = 'fornecedor_vendas'), 0) + 10,
       true, 'fornecedor_vendas'
WHERE NOT EXISTS (
  SELECT 1 FROM public.sidebar_menu_items
  WHERE module_code = 'fornecedor_vendas' AND item_code = 'fornecedor_produtos'
);
