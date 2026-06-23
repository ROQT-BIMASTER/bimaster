-- Paridade do menu Estoque entre v1 e v2 + duas novas telas Futura

-- 1) Telas novas no catálogo (para os screen_codes referenciados pelo App.tsx)
INSERT INTO public.telas_sistema (codigo, nome, descricao, rota, modulo_codigo, ativo)
VALUES
  ('estoque_marca_niveis', 'Estoque Marca × 3 Níveis', 'Explode estoque do fornecedor Futura em CX/BX/UN por marca usando composição', '/dashboard/estoque/marca-niveis', 'estoque', true),
  ('estoque_marca_vs_distribuidoras', 'Consolidado Marca × Distribuidoras', 'Confronta saldo Futura com saldo nas distribuidoras', '/dashboard/estoque/marca-vs-distribuidoras', 'estoque', true)
ON CONFLICT (codigo) DO NOTHING;

-- 2) Itens de menu faltantes no módulo Estoque
INSERT INTO public.sidebar_menu_items
  (module_code, item_code, label, icon, route, ordem, ativo, screen_code, require_admin)
VALUES
  ('estoque', 'est_visao_geral',          'Visão de Estoque',              'BarChart3', '/dashboard/estoque/visao-geral',           10, true, NULL,                              false),
  ('estoque', 'est_valores_por_filial',   'Valores por Filial',            'Building2', '/dashboard/estoque/valores-por-filial',    11, true, NULL,                              false),
  ('estoque', 'est_unificado',            'Estoque Unificado (3 níveis)',  'Layers',    '/dashboard/estoque/unificado',             12, true, NULL,                              false),
  ('estoque', 'est_cores',                'Estoque por Cor (Unidades)',    'Layers',    '/dashboard/estoque/cores',                 13, true, NULL,                              false),
  ('estoque', 'est_marca_niveis',         'Estoque Marca × 3 Níveis',      'Layers',    '/dashboard/estoque/marca-niveis',          14, true, 'estoque_marca_niveis',            false),
  ('estoque', 'est_marca_vs_dist',        'Marca × Distribuidoras',        'BarChart3', '/dashboard/estoque/marca-vs-distribuidoras', 15, true, 'estoque_marca_vs_distribuidoras', false),
  ('estoque', 'est_fornecedor',           'Estoque do Fornecedor',         'Package',   '/dashboard/fornecedor/estoque',            16, true, 'fornecedor_estoque',              false),
  ('estoque', 'est_etiquetas',            'Etiquetas de Campanha',         'Layers',    '/dashboard/estoque/etiquetas',             20, true, NULL,                              false),
  ('estoque', 'est_auditoria_drift',      'Auditoria Drift vs ERP',        'Layers',    '/dashboard/estoque/auditoria-drift',       30, true, NULL,                              true),
  ('estoque', 'est_reconc_cores',         'Reconciliação Cores',           'Layers',    '/dashboard/estoque/reconciliacao-cores',   31, true, NULL,                              true),
  ('estoque', 'est_auditoria_linhas_erp', 'Auditoria Linhas ERP',          'Layers',    '/dashboard/estoque/auditoria-linhas-erp',  32, true, NULL,                              true),
  ('estoque', 'est_analise_erp',          'Análise Estoque ERP',           'BarChart3', '/dashboard/estoque/analise-erp',           33, true, NULL,                              true),
  ('estoque', 'est_sync_erp',             'Sync Estoque ERP',              'RefreshCw', '/dashboard/estoque/sync-erp',              34, true, NULL,                              true)
ON CONFLICT (module_code, item_code) DO NOTHING;