
-- 1. Módulo sistema
INSERT INTO public.modulos_sistema (codigo, nome, descricao, icone, ordem, ativo)
VALUES ('compras', 'Compras', 'Compras internas das distribuidoras (entradas Futura e afins)', 'ShoppingCart', 25, true)
ON CONFLICT (codigo) DO NOTHING;

-- 2. Categoria sidebar
INSERT INTO public.sidebar_categories (key, label, icon, ordem, ativo)
VALUES ('compras', 'Compras', 'ShoppingCart', 2, true)
ON CONFLICT (key) DO NOTHING;

-- 3. Vínculo categoria ↔ módulo
INSERT INTO public.sidebar_category_modules (category_id, module_code, icon_override, ordem, ativo)
SELECT c.id, 'compras', 'ShoppingCart', 1, true
FROM public.sidebar_categories c
WHERE c.key = 'compras'
ON CONFLICT (category_id, module_code) DO NOTHING;

-- 4. Item de menu (Entradas Futura)
INSERT INTO public.sidebar_menu_items (module_code, item_code, label, icon, route, ordem, ativo, require_admin, require_admin_or_supervisor)
VALUES ('compras', 'compras_entradas_futura', 'Entradas Futura', 'Receipt', '/dashboard/compras/entradas-futura', 1, true, false, false)
ON CONFLICT (module_code, item_code) DO NOTHING;

-- 5. Replica permissões do módulo `fornecedor` para `compras`
--   role
INSERT INTO public.role_permissoes_modulos (role, modulo_id)
SELECT rpm.role, m_new.id
FROM public.role_permissoes_modulos rpm
JOIN public.modulos_sistema m_old ON m_old.id = rpm.modulo_id AND m_old.codigo = 'fornecedor'
CROSS JOIN LATERAL (SELECT id FROM public.modulos_sistema WHERE codigo = 'compras') m_new
ON CONFLICT DO NOTHING;

--   departamento
INSERT INTO public.departamento_permissoes_modulos (departamento_id, modulo_id)
SELECT dpm.departamento_id, m_new.id
FROM public.departamento_permissoes_modulos dpm
JOIN public.modulos_sistema m_old ON m_old.id = dpm.modulo_id AND m_old.codigo = 'fornecedor'
CROSS JOIN LATERAL (SELECT id FROM public.modulos_sistema WHERE codigo = 'compras') m_new
ON CONFLICT DO NOTHING;

--   usuário
INSERT INTO public.usuario_permissoes_modulos (usuario_id, modulo_id)
SELECT upm.usuario_id, m_new.id
FROM public.usuario_permissoes_modulos upm
JOIN public.modulos_sistema m_old ON m_old.id = upm.modulo_id AND m_old.codigo = 'fornecedor'
CROSS JOIN LATERAL (SELECT id FROM public.modulos_sistema WHERE codigo = 'compras') m_new
ON CONFLICT DO NOTHING;
