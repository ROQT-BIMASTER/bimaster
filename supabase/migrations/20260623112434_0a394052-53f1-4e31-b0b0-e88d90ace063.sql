INSERT INTO public.sidebar_menu_items
  (module_code, item_code, label, icon, route, parent_group, ordem, ativo, require_admin)
SELECT v.module_code, v.item_code, v.label, v.icon, v.route, v.parent_group, v.ordem, v.ativo, v.require_admin
FROM (VALUES
  ('admin', 'central_amostras',    'Central — Amostras',      'Layers',       '/dashboard/central/amostras',    'Centrais administrativas', 30, true, true),
  ('admin', 'central_composicao',  'Central — Composição',    'FlaskConical', '/dashboard/central/composicao',  'Centrais administrativas', 31, true, true),
  ('admin', 'central_embalagens',  'Central — Embalagens',    'Package',      '/dashboard/central/embalagens',  'Centrais administrativas', 32, true, true),
  ('admin', 'central_motor_artes', 'Central — Motor de Artes','Palette',      '/dashboard/central/motor-artes', 'Centrais administrativas', 33, true, true)
) AS v(module_code, item_code, label, icon, route, parent_group, ordem, ativo, require_admin)
WHERE NOT EXISTS (SELECT 1 FROM public.sidebar_menu_items s WHERE s.route = v.route);