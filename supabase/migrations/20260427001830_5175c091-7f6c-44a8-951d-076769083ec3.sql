INSERT INTO public.sidebar_menu_items (module_code, item_code, label, icon, route, ordem, ativo, require_admin, require_admin_or_supervisor)
VALUES
  ('projetos', 'proj_relatorios', 'Relatórios', 'BarChart3', '/dashboard/projetos/relatorios', 6, true, false, true),
  ('admin', 'adm_calendario_corp', 'Calendário Corporativo', 'CalendarDays', '/dashboard/admin/calendario-corporativo', 10, true, true, false)
ON CONFLICT (module_code, item_code) DO UPDATE
SET label = EXCLUDED.label,
    icon = EXCLUDED.icon,
    route = EXCLUDED.route,
    ordem = EXCLUDED.ordem,
    ativo = true,
    require_admin = EXCLUDED.require_admin,
    require_admin_or_supervisor = EXCLUDED.require_admin_or_supervisor,
    updated_at = now();