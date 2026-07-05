-- Concede módulo "cadastros" e todas as telas cadastros_* para perfis administrativos/financeiros
INSERT INTO public.role_permissoes_modulos (role, modulo_id)
SELECT r.role, ms.id
FROM (VALUES ('supervisor'::app_role), ('gerente'::app_role), ('consultor'::app_role), ('suporte'::app_role)) r(role)
CROSS JOIN public.modulos_sistema ms
WHERE ms.codigo = 'cadastros'
ON CONFLICT (role, modulo_id) DO NOTHING;

INSERT INTO public.role_permissoes_telas (role, tela_id)
SELECT r.role, ts.id
FROM (VALUES ('supervisor'::app_role), ('gerente'::app_role), ('consultor'::app_role), ('suporte'::app_role)) r(role)
CROSS JOIN public.telas_sistema ts
WHERE ts.codigo IN (
  'cadastros_fornecedores',
  'cadastros_bancos',
  'cadastros_portadores',
  'cadastros_centros_custo',
  'cadastros_plano_contas',
  'cadastros_departamentos',
  'cadastros_empresas',
  'cadastros_clientes'
)
ON CONFLICT (role, tela_id) DO NOTHING;