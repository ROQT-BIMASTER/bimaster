
-- 1) Nova tela para gate de Inbox do Comprador
INSERT INTO public.telas_sistema (codigo, nome, rota, modulo_codigo, icone, ordem, ativo)
VALUES ('compras_inbox_comprador', 'Inbox do Comprador', '/dashboard/compras-internacionais/inbox', 'china', 'inbox', 50, true)
ON CONFLICT (codigo) DO NOTHING;

-- 2) Limpar permissões indevidas do usuário Ruby Rose
DELETE FROM public.usuario_permissoes_telas upt
USING public.telas_sistema ts
WHERE upt.tela_id = ts.id
  AND upt.usuario_id = '6bc253d3-7335-42a2-a644-6c0183fb949a'
  AND ts.codigo IN ('projetos_inbox', 'financeiro_fluxo_caixa');

-- 3) Garantir que tem acesso a todas as telas China esperadas (idempotente)
INSERT INTO public.usuario_permissoes_telas (usuario_id, tela_id)
SELECT '6bc253d3-7335-42a2-a644-6c0183fb949a', ts.id
FROM public.telas_sistema ts
WHERE ts.codigo IN (
  'china_dashboard',
  'china_fichas',
  'china_submissoes',
  'china_recebimentos',
  'china_ordens',
  'china_ordens_producao'
)
ON CONFLICT DO NOTHING;
