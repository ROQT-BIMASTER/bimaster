
INSERT INTO public.role_permissoes_telas (role, tela_id)
SELECT 'admin'::app_role, id FROM public.telas_sistema WHERE codigo = 'trade_admin'
ON CONFLICT (role, tela_id) DO NOTHING;

INSERT INTO public.role_permissoes_telas (role, tela_id)
SELECT r::app_role, ts.id
FROM public.telas_sistema ts
CROSS JOIN (VALUES ('supervisor'), ('gerente')) AS roles(r)
WHERE ts.codigo IN ('orcamento_periodos','orcamento_distribuicao','orcamento_plano','financeiro_torre_despesas')
ON CONFLICT (role, tela_id) DO NOTHING;
