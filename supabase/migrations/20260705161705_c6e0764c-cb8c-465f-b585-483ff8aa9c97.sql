
-- ============================================================
-- PARTE A — Conceder papéis padrão às telas do Financeiro
-- ============================================================

WITH admin_only(codigo) AS (VALUES
  ('financeiro_plano_contas'), ('financeiro_plano_contas_page'),
  ('financeiro_centros_custo'), ('financeiro_empresas'),
  ('financeiro_fornecedores'), ('financeiro_consolidado'),
  ('financeiro_investimentos'), ('financeiro_credito')
),
t AS (SELECT ao.codigo, ts.id AS tela_id FROM admin_only ao JOIN public.telas_sistema ts USING (codigo))
INSERT INTO public.role_permissoes_telas (role, tela_id)
SELECT 'admin'::app_role, tela_id FROM t
ON CONFLICT (role, tela_id) DO NOTHING;

WITH gestao(codigo) AS (VALUES
  ('financeiro_dashboard'), ('financeiro_dre'),
  ('financeiro_departamentos'), ('financeiro_fluxo_caixa'),
  ('financeiro_saldos_bancarios'), ('financeiro_verbas'),
  ('financeiro_conciliacao'), ('financeiro_contas_pagar'),
  ('financeiro_contas_receber'), ('financeiro_classificar'),
  ('financeiro_cobrancas'), ('financeiro_aprovacoes_depts')
),
t AS (SELECT g.codigo, ts.id AS tela_id FROM gestao g JOIN public.telas_sistema ts USING (codigo)),
papeis(r) AS (VALUES ('admin'), ('supervisor'), ('gerente'))
INSERT INTO public.role_permissoes_telas (role, tela_id)
SELECT p.r::app_role, t.tela_id FROM t CROSS JOIN papeis p
ON CONFLICT (role, tela_id) DO NOTHING;

-- ============================================================
-- PARTE B — Consolidar duplicatas: copiar concessões e desativar
-- ============================================================

CREATE TEMP TABLE _dup_map (canonico text, duplicado text) ON COMMIT DROP;
INSERT INTO _dup_map (canonico, duplicado) VALUES
  ('ai_analytics',            'AI_ANALYTICS'),
  ('projetos_briefings',      'briefings_agente'),
  ('cadastros_centros_custo', 'financeiro_centros_custo'),
  ('cadastros_clientes',      'ci_clientes'),
  ('configuracoes',           'admin'),
  ('cadastros_departamentos', 'departamentos_hub'),
  ('cadastros_empresas',      'financeiro_empresas'),
  ('eventos_dashboard',       'eventos_lista'),
  ('financeiro_dashboard',    'financeiro_index'),
  ('financeiro_plano_contas', 'cadastros_plano_contas'),
  ('financeiro_verbas',       'financeiro_trade'),
  ('financeiro_departamentos','financeiro_visao_dept'),
  ('cadastros_fornecedores',  'financeiro_fornecedores'),
  ('comercial_importar',      'importar'),
  ('marketing_social',        'MARKETING_SOCIAL'),
  ('marketing_whatsapp',      'MARKETING_WHATSAPP'),
  ('orcamento_periodos',      'orcamento_distribuicao'),
  ('orcamento_periodos',      'orcamento_plano'),
  ('ci_executivo',            'central_inteligencia'),
  ('precos_portal_cliente',   'precos_portal'),
  ('prospects',               'PROSPECTS_DASHBOARD'),
  ('prospects_atividades',    'atividades'),
  ('prospects_atividades',    'PROSPECTS_ATIVIDADES'),
  ('prospects_kanban',        'kanban'),
  ('prospects_kanban',        'PROSPECTS_KANBAN'),
  ('prospects_lista',         'PROSPECTS_LISTA'),
  ('prospects_mapa',          'mapa'),
  ('prospects_mapa',          'PROSPECTS_MAPA'),
  ('prospects_municipios',    'municipios'),
  ('prospects_municipios',    'PROSPECTS_MUNICIPIOS'),
  ('trade_ranking',           'ranking'),
  ('relatorios',              'RELATORIOS_DASHBOARD'),
  ('trade_marketing',         'TRADE_DASHBOARD'),
  ('trade_auditorias',        'TRADE_AUDITORIAS'),
  ('trade_import_stores',     'trade_import'),
  ('trade_performance',       'TRADE_PERFORMANCE'),
  ('trade_photos',            'TRADE_FOTOS'),
  ('trade_stores',            'TRADE_LOJAS'),
  ('trade_visits',            'TRADE_VISITAS');

-- Mapa de ids resolvidos (só entradas onde ambos existem)
CREATE TEMP TABLE _dup_ids AS
SELECT dm.duplicado, dm.canonico,
       tc.id AS canon_id, td.id AS dup_id
FROM _dup_map dm
JOIN public.telas_sistema tc ON tc.codigo = dm.canonico
JOIN public.telas_sistema td ON td.codigo = dm.duplicado;

-- Copiar concessões por papel
INSERT INTO public.role_permissoes_telas (role, tela_id)
SELECT r.role, di.canon_id
FROM public.role_permissoes_telas r
JOIN _dup_ids di ON di.dup_id = r.tela_id
ON CONFLICT (role, tela_id) DO NOTHING;

-- Copiar concessões por usuário
INSERT INTO public.usuario_permissoes_telas (usuario_id, tela_id)
SELECT u.usuario_id, di.canon_id
FROM public.usuario_permissoes_telas u
JOIN _dup_ids di ON di.dup_id = u.tela_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.usuario_permissoes_telas x
  WHERE x.usuario_id = u.usuario_id AND x.tela_id = di.canon_id
);

-- Copiar concessões por departamento
INSERT INTO public.departamento_permissoes_telas (departamento_id, tela_id)
SELECT d.departamento_id, di.canon_id
FROM public.departamento_permissoes_telas d
JOIN _dup_ids di ON di.dup_id = d.tela_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.departamento_permissoes_telas x
  WHERE x.departamento_id = d.departamento_id AND x.tela_id = di.canon_id
);

-- Desativar duplicados
UPDATE public.telas_sistema
   SET ativo = false
 WHERE id IN (SELECT dup_id FROM _dup_ids);
