
-- PARTE 2: Remover políticas permissivas antigas (tabelas F-M)

-- fabrica_historico_custos
DROP POLICY IF EXISTS "Sistema pode inserir histórico de custos" ON public.fabrica_historico_custos;

-- fabrica_historico_precos  
DROP POLICY IF EXISTS "Sistema registra histórico de preços" ON public.fabrica_historico_precos;

-- fabrica_itens_nf
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar itens de NF" ON public.fabrica_itens_nf;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir itens de NF" ON public.fabrica_itens_nf;

-- fabrica_notas_fiscais
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar notas fiscais" ON public.fabrica_notas_fiscais;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir notas fiscais" ON public.fabrica_notas_fiscais;

-- fabrica_processamento_logs
DROP POLICY IF EXISTS "Sistema pode inserir logs" ON public.fabrica_processamento_logs;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir logs" ON public.fabrica_processamento_logs;

-- fabrica_regras_fiscais
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar regras fiscais" ON public.fabrica_regras_fiscais;
DROP POLICY IF EXISTS "Usuários autenticados podem criar regras fiscais" ON public.fabrica_regras_fiscais;

-- historico_cobrancas
DROP POLICY IF EXISTS "historico_cobrancas_insert" ON public.historico_cobrancas;

-- huggs_usage_logs
DROP POLICY IF EXISTS "Sistema insere logs" ON public.huggs_usage_logs;

-- integration_logs
DROP POLICY IF EXISTS "Sistema insere logs" ON public.integration_logs;

-- kpi_snapshots
DROP POLICY IF EXISTS "System can insert KPI snapshots" ON public.kpi_snapshots;

-- marketing_notifications
DROP POLICY IF EXISTS "System can insert notifications" ON public.marketing_notifications;

-- marketing_points_history
DROP POLICY IF EXISTS "System can insert points" ON public.marketing_points_history;

-- marketing_user_badges
DROP POLICY IF EXISTS "System can insert user badges" ON public.marketing_user_badges;

-- marketing_user_stats
DROP POLICY IF EXISTS "System can insert stats" ON public.marketing_user_stats;
