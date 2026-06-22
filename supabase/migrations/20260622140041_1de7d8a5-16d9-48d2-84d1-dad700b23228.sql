INSERT INTO public.sidebar_menu_items (module_code, item_code, label, icon, route, ordem, ativo)
VALUES ('central_inteligencia', 'ci_analise_vendas', 'Análise de Vendas', 'BarChart3', '/dashboard/vendas/analise', 9, true)
ON CONFLICT DO NOTHING;