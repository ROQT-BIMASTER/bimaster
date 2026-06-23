DELETE FROM public.sidebar_menu_items
 WHERE route IN ('/dashboard/controladoria', '/dashboard/rr-tasks');

INSERT INTO public.sidebar_menu_items
  (module_code, item_code, label, icon, route, parent_group, ordem, ativo, screen_code, require_admin, require_admin_or_supervisor)
VALUES
  ('projetos', 'projetos_controladoria', 'Controladoria', 'PackageSearch', '/dashboard/controladoria', 'Apoio', 60, true, 'admin', true, false),
  ('projetos', 'projetos_rr_tasks',     'RR-Tasks',      'KanbanSquare',  '/dashboard/rr-tasks',      'Apoio', 70, true, NULL,    false, false);