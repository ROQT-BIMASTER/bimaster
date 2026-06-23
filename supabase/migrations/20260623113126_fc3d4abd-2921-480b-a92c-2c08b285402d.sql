-- 1. Registrar a tela no catálogo
INSERT INTO public.telas_sistema (codigo, nome, descricao, icone, rota, modulo_codigo, ordem, ativo, acesso_padrao)
SELECT 'projetos_briefings', 'Briefings', 'Gestão de briefings de projetos', 'FileText', '/dashboard/briefings', 'projetos', 50, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.telas_sistema WHERE codigo = 'projetos_briefings');

-- 2. Itens de menu sob projetos / Briefings
INSERT INTO public.sidebar_menu_items
  (module_code, item_code, label, icon, route, parent_group, ordem, ativo, require_admin, screen_code)
SELECT v.module_code, v.item_code, v.label, v.icon, v.route, v.parent_group, v.ordem, v.ativo, v.require_admin, v.screen_code
FROM (VALUES
  ('projetos', 'projetos_briefings',         'Briefings',      'FileText',  '/dashboard/briefings',     'Briefings', 40, true, false, 'projetos_briefings'),
  ('projetos', 'projetos_briefings_fluxos',  'Fluxos padrão',  'GitBranch', '/admin/briefings-fluxos',  'Briefings', 41, true, true,  'admin')
) AS v(module_code, item_code, label, icon, route, parent_group, ordem, ativo, require_admin, screen_code)
WHERE NOT EXISTS (SELECT 1 FROM public.sidebar_menu_items s WHERE s.route = v.route);