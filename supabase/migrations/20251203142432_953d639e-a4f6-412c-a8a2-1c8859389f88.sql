
-- Criar departamentos padrão se não existirem
INSERT INTO public.departamentos (nome, descricao, ativo)
VALUES 
  ('Trade Marketing', 'Equipe de Trade Marketing - gestão de PDV, visitas e promoções', true),
  ('Marketing', 'Equipe de Marketing - campanhas, mídias sociais e branding', true),
  ('Operações', 'Equipe de Operações - fábrica, produção e precificação', true),
  ('Comercial', 'Equipe Comercial - prospecção e vendas', true),
  ('Financeiro', 'Equipe Financeira - contas, orçamentos e relatórios financeiros', true)
ON CONFLICT DO NOTHING;

-- Associar departamentos aos módulos
-- Trade Marketing: trade + dashboard
INSERT INTO public.departamento_permissoes_modulos (departamento_id, modulo_id)
SELECT d.id, m.id
FROM public.departamentos d
CROSS JOIN public.modulos_sistema m
WHERE d.nome = 'Trade Marketing'
  AND m.codigo IN ('trade', 'dashboard')
  AND m.ativo = true
ON CONFLICT DO NOTHING;

-- Marketing: marketing + dashboard
INSERT INTO public.departamento_permissoes_modulos (departamento_id, modulo_id)
SELECT d.id, m.id
FROM public.departamentos d
CROSS JOIN public.modulos_sistema m
WHERE d.nome = 'Marketing'
  AND m.codigo IN ('marketing', 'dashboard')
  AND m.ativo = true
ON CONFLICT DO NOTHING;

-- Operações: fabrica + tabelas_precos + dashboard
INSERT INTO public.departamento_permissoes_modulos (departamento_id, modulo_id)
SELECT d.id, m.id
FROM public.departamentos d
CROSS JOIN public.modulos_sistema m
WHERE d.nome = 'Operações'
  AND m.codigo IN ('fabrica', 'tabelas_precos', 'dashboard')
  AND m.ativo = true
ON CONFLICT DO NOTHING;

-- Comercial: prospects + dashboard
INSERT INTO public.departamento_permissoes_modulos (departamento_id, modulo_id)
SELECT d.id, m.id
FROM public.departamentos d
CROSS JOIN public.modulos_sistema m
WHERE d.nome = 'Comercial'
  AND m.codigo IN ('prospects', 'dashboard')
  AND m.ativo = true
ON CONFLICT DO NOTHING;

-- Financeiro: financeiro + dashboard
INSERT INTO public.departamento_permissoes_modulos (departamento_id, modulo_id)
SELECT d.id, m.id
FROM public.departamentos d
CROSS JOIN public.modulos_sistema m
WHERE d.nome = 'Financeiro'
  AND m.codigo IN ('financeiro', 'dashboard')
  AND m.ativo = true
ON CONFLICT DO NOTHING;
