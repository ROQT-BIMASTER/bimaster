INSERT INTO public.modulos_sistema (codigo, nome, descricao, icone, ordem, ativo, acesso_padrao)
SELECT 'configuracoes', 'Configurações', 'Painel administrativo de configurações do sistema', 'Settings', 100, true, false
WHERE NOT EXISTS (SELECT 1 FROM public.modulos_sistema WHERE codigo = 'configuracoes');

INSERT INTO public.sidebar_categories (key, label, icon, ordem, ativo)
SELECT 'configuracoes', 'Configurações', 'Settings', 99, true
WHERE NOT EXISTS (SELECT 1 FROM public.sidebar_categories WHERE key = 'configuracoes');

INSERT INTO public.sidebar_category_modules (category_id, module_code, ordem, ativo)
SELECT c.id, 'configuracoes', 1, true
FROM public.sidebar_categories c
WHERE c.key = 'configuracoes'
  AND NOT EXISTS (
    SELECT 1 FROM public.sidebar_category_modules scm
    WHERE scm.category_id = c.id AND scm.module_code = 'configuracoes'
  );

UPDATE public.sidebar_menu_items
SET module_code = 'configuracoes', parent_group = 'Configurações', updated_at = now()
WHERE route IN (
  '/dashboard/configuracoes/lgpd',
  '/dashboard/configuracoes/menu',
  '/dashboard/configuracoes/acesso',
  '/configuracoes/admin/relatorio-ap-erp'
);

DELETE FROM public.sidebar_menu_items WHERE route = '/dashboard/integracoes/notion';

INSERT INTO public.sidebar_menu_items
  (module_code, item_code, label, icon, route, parent_group, ordem, ativo, require_admin)
SELECT v.module_code, v.item_code, v.label, v.icon, v.route, v.parent_group, v.ordem, v.ativo, v.require_admin
FROM (VALUES
  ('configuracoes', 'cfg_geral',              'Geral',                 'Settings',    '/dashboard/configuracoes',                   'Configurações', 10, true, true),
  ('configuracoes', 'cfg_permissoes_modulo',  'Permissões por módulo', 'ShieldCheck', '/dashboard/configuracoes/permissoes-modulo', 'Configurações', 50, true, true),
  ('configuracoes', 'cfg_integracoes_notion', 'Integrações — Notion',  'Plug',        '/configuracoes/integracoes/notion',          'Configurações', 60, true, true)
) AS v(module_code, item_code, label, icon, route, parent_group, ordem, ativo, require_admin)
WHERE NOT EXISTS (
  SELECT 1 FROM public.sidebar_menu_items s WHERE s.route = v.route
);