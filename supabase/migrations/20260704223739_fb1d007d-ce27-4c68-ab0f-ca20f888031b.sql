
-- Categoria
INSERT INTO public.sidebar_categories (key, label, icon, ordem, ativo)
VALUES ('cadastros', 'Cadastros', 'Database', 55, true)
ON CONFLICT (key) DO UPDATE SET label=EXCLUDED.label, icon=EXCLUDED.icon, ordem=EXCLUDED.ordem, ativo=true;

-- Módulo
INSERT INTO public.modulos_sistema (codigo, nome, descricao, ativo)
VALUES ('cadastros', 'Cadastros', 'Cadastros base do sistema (fornecedores, empresas, contas, portadores, plano de contas)', true)
ON CONFLICT (codigo) DO UPDATE SET nome=EXCLUDED.nome, descricao=EXCLUDED.descricao, ativo=true;

-- Vincula módulo à categoria
INSERT INTO public.sidebar_category_modules (category_id, module_code, ordem, ativo)
SELECT c.id, 'cadastros', 1, true FROM public.sidebar_categories c WHERE c.key='cadastros'
ON CONFLICT DO NOTHING;

-- Telas
INSERT INTO public.telas_sistema (codigo, nome, descricao, rota, modulo_codigo, ativo, ordem, acesso_padrao) VALUES
  ('cadastros_fornecedores', 'Fornecedores', 'Cadastro de fornecedores', '/dashboard/fornecedores', 'cadastros', true, 1, false),
  ('cadastros_bancos', 'Contas Bancárias', 'Contas bancárias da empresa', '/dashboard/bancos', 'cadastros', true, 2, false),
  ('cadastros_portadores', 'Portadores', 'Portadores/bancos usados em cobrança', '/dashboard/portadores', 'cadastros', true, 3, false),
  ('cadastros_centros_custo', 'Centros de Custo', 'Centros de custo', '/dashboard/centros-custo', 'cadastros', true, 4, false),
  ('cadastros_plano_contas', 'Plano de Contas', 'Plano de contas contábil', '/dashboard/financeiro/plano-contas', 'cadastros', true, 5, false),
  ('cadastros_departamentos', 'Departamentos', 'Departamentos', '/dashboard/departamentos', 'cadastros', true, 6, false),
  ('cadastros_empresas', 'Empresas', 'Empresas do grupo', '/dashboard/empresas', 'cadastros', true, 7, false),
  ('cadastros_clientes', 'Clientes', 'Análise/base de clientes', '/dashboard/clientes', 'cadastros', true, 8, false)
ON CONFLICT (codigo) DO UPDATE SET nome=EXCLUDED.nome, descricao=EXCLUDED.descricao, rota=EXCLUDED.rota, modulo_codigo=EXCLUDED.modulo_codigo, ativo=true;

-- Permissões admin (modulo)
INSERT INTO public.role_permissoes_modulos (role, modulo_id)
SELECT 'admin'::app_role, m.id FROM public.modulos_sistema m WHERE m.codigo='cadastros'
ON CONFLICT (role, modulo_id) DO NOTHING;

-- Permissões admin (telas)
INSERT INTO public.role_permissoes_telas (role, tela_id)
SELECT 'admin'::app_role, t.id FROM public.telas_sistema t
WHERE t.codigo IN (
  'cadastros_fornecedores','cadastros_bancos','cadastros_portadores',
  'cadastros_centros_custo','cadastros_plano_contas','cadastros_departamentos',
  'cadastros_empresas','cadastros_clientes'
)
ON CONFLICT (role, tela_id) DO NOTHING;

-- Novo campo em fornecedores
ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS prazo_pagamento_padrao integer;

COMMENT ON COLUMN public.fornecedores.prazo_pagamento_padrao IS 'Prazo padrão em dias entre emissão e vencimento das NFs deste fornecedor (integração Result).';
