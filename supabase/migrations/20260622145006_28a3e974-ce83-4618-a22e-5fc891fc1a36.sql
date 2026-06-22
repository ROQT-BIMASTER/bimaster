
-- 1. Módulo
INSERT INTO public.modulos_sistema (codigo, nome, descricao, icone, ordem, ativo)
VALUES ('fornecedor', 'Fornecedor', 'Vendas e estoque sob a ótica do fornecedor', 'Truck', 35, true)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  icone = EXCLUDED.icone,
  ativo = true;

-- 2. Telas
INSERT INTO public.telas_sistema (codigo, modulo_codigo, nome, descricao, rota, icone, ordem, ativo)
VALUES
  ('fornecedor_vendas', 'fornecedor', 'Análise de Vendas', 'KPIs, ranking e detalhamento de vendas faturadas', '/dashboard/fornecedor/vendas', 'BarChart3', 1, true),
  ('fornecedor_estoque', 'fornecedor', 'Estoque do Fornecedor', 'Posição de estoque e cobertura', '/dashboard/fornecedor/estoque', 'Warehouse', 2, true),
  ('fornecedor_depara_ean', 'fornecedor', 'De-Para EAN', 'Mapeamento de EAN do fornecedor', '/dashboard/fornecedor/depara-ean', 'ArrowUpDown', 3, true)
ON CONFLICT (codigo) DO UPDATE SET
  modulo_codigo = EXCLUDED.modulo_codigo,
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  rota = EXCLUDED.rota,
  icone = EXCLUDED.icone,
  ordem = EXCLUDED.ordem,
  ativo = true;

-- 3. Itens de menu
INSERT INTO public.sidebar_menu_items (module_code, item_code, label, icon, route, ordem, ativo, require_admin, require_admin_or_supervisor, screen_code)
VALUES
  ('fornecedor', 'forn_vendas', 'Análise de Vendas', 'BarChart3', '/dashboard/fornecedor/vendas', 1, true, true, false, 'fornecedor_vendas'),
  ('fornecedor', 'forn_estoque', 'Estoque do Fornecedor', 'Warehouse', '/dashboard/fornecedor/estoque', 2, true, true, false, 'fornecedor_estoque'),
  ('fornecedor', 'forn_depara', 'De-Para EAN', 'ArrowUpDown', '/dashboard/fornecedor/depara-ean', 3, true, true, false, 'fornecedor_depara_ean')
ON CONFLICT (module_code, item_code) DO UPDATE SET
  label = EXCLUDED.label,
  icon = EXCLUDED.icon,
  route = EXCLUDED.route,
  ordem = EXCLUDED.ordem,
  ativo = true,
  require_admin = EXCLUDED.require_admin,
  require_admin_or_supervisor = EXCLUDED.require_admin_or_supervisor,
  screen_code = EXCLUDED.screen_code,
  updated_at = now();

-- 4. Desativar item antigo de vendas (se existir)
UPDATE public.sidebar_menu_items
   SET ativo = false, updated_at = now()
 WHERE route IN ('/dashboard/vendas/analise', '/dashboard/estoque/fornecedor', '/dashboard/estoque/fornecedor-depara')
   AND module_code <> 'fornecedor';
