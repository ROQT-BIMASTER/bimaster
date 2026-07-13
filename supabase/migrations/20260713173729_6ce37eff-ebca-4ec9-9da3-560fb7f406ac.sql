INSERT INTO public.sidebar_menu_items
  (module_code, item_code, label, icon, route, ordem, ativo, require_admin, require_admin_or_supervisor)
VALUES
  ('compras', 'compras_entradas_result', 'Entradas Result (livro)', 'Receipt', '/dashboard/compras/entradas-result', 2, true, false, false),
  ('compras', 'compras_vendas',          'Compras × Vendas',        'TrendingUp', '/dashboard/compras/vendas',        3, true, false, false)
ON CONFLICT (module_code, item_code) DO UPDATE
SET label = EXCLUDED.label,
    icon = EXCLUDED.icon,
    route = EXCLUDED.route,
    ordem = EXCLUDED.ordem,
    ativo = true,
    updated_at = now();