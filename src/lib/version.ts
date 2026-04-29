import { logger } from "@/lib/logger";
// Versão do app - incrementar a cada deploy significativo
// PR-71 (v3.4.38): Estoque — Visão Inteligente de Estoque entregue.
//   Nova rota `/dashboard/estoque/visao-geral` com tabela paginada,
//   KPIs agregados, filtros multi-empresa/marca/curva ABC, faixas dinâmicas
//   por quartis (RPC `estoque_faixas_saldo`), chips rápidos (Crítico/Excesso/
//   Pendentes/Sem Movimento), drawer de detalhe por SKU e exportação Excel
//   até 50k linhas. RLS por `user_empresas` + índices `pg_trgm` e parciais
//   garantem isolamento e performance sobre os ~9.9k registros sincronizados
//   do ERP. Sync engine `transformEstoque` corrigida para popular `saldo`,
//   `custo_total` (com fallback `saldo * custo_unit`), curvas físicas/
//   monetárias, código fabricante, linha, unidade de medida, pedidos
//   pendentes e data da última compra. Sem mudança de SDK/OpenAPI.
// PR-70 (v3.4.37): Influenciadores — Busca real via Apify (Instagram/TikTok).
//   Nova edge function `apify-influencer-search` que usa Apify Actors
//   (`apify/instagram-hashtag-scraper`, `apify/instagram-profile-scraper`,
//   `clockworks/tiktok-scraper`) via run-sync-get-dataset-items para retornar
//   perfis REAIS com followers, avatar, bio, ER calculado e flag de verificação.
//   Fluxo por tipo de query: `@usuario` → profile-scraper direto; `#hashtag` →
//   hashtag-scraper extrai owners únicos, top N por engajamento são enriquecidos
//   via profile-scraper; termo livre → mesma estratégia tratando como hashtag.
//   `discover-influencers` ganha Layer 0 (Apify primeiro) — Gemini/GPT viram
//   fallback apenas se Apify retornar vazio. `source` por item preservado
//   (`apify_instagram` / `apify_tiktok` / `apify_hashtag`) para auditoria.
//   Requer secret `APIFY_API_TOKEN` configurado. Resolve "luluca não encontrada"
//   e similares — IA não inventa mais perfis quando Apify devolve dados reais.
// PR-69 (v3.4.36): Influenciadores — Autopilot/Conteúdo IA compartilhados.
//   Edge functions `influencer-autopilot` e `influencer-content-intelligence`
//   ainda filtravam `.eq("user_id", user.id)` em todas as leituras de
//   `influencers` e `influencer_suggestions`, quebrando os botões "Atualizar
//   Análise" (Oportunidades IA), "Recalcular Ranking", "Atualizar Dados" e
//   "Analisar Conteúdo dos Influenciadores" para qualquer membro da equipe
//   Marketing que não fosse o owner original dos registros (HTTP 400 "Nenhum
//   influenciador cadastrado"). Removido `user_id` das 5 queries de leitura
//   afetadas — visibilidade passa a depender exclusivamente das RLS de equipe
//   `marketing_social` (PR-66). Filtros em `influencer_company_profile`
//   (configuração pessoal por usuário) preservados. Sem mudança de schema.
// PR-68 (v3.4.35): Influenciadores — Recomendação por IA refatorada (sem influencer alvo).
//   `analysis_type='recommendation'` deixa de exigir `influencer_id` (era um
//   workaround frágil: frontend pegava 1 ID dummy e a edge function ainda
//   tentava resolvê-lo via lookup). Agora o frontend não envia `influencer_id`,
//   a edge function pula o lookup do influencer alvo, pula carregamento de
//   posts/comments e pula o INSERT em `influencer_analyses` (que requer
//   `influencer_id NOT NULL`) — apenas lista TODOS os ativos via RLS e gera
//   ranking comparativo. Mensagens de erro mais claras propagadas via
//   `error.context.body`. Sem mudança de schema.
// PR-67 (v3.4.34): Influenciadores — Recomendação por IA corrigida.
//   Edge function `analyze-influencer` ainda filtrava influencers por
//   `.eq("user_id", user.id)` em duas queries (lookup do influencer alvo e
//   listagem para `analysis_type=recommendation`), incompatível com o modelo
//   compartilhado de equipe Marketing introduzido na v3.4.32. Resultado: o
//   modal "Recomendar para minha marca" disparava 404 ("Influenciador não
//   encontrado") sempre que o registro pertencia a outro usuário do time.
//   Removido o filtro `user_id` em ambas as queries — visibilidade passa a
//   ser controlada exclusivamente pelas RLS policies `Marketing team can view
//   all *` (PR-66). `.single()` substituído por `.maybeSingle()` para
//   degradar com mensagem clara em vez de exception. Sem mudança de schema.
// PR-66 (v3.4.32): Influenciadores como módulo de equipe Marketing.
//   Visualização de `influencers` e tabelas relacionadas
//   (`influencer_suggestions`, `influencer_opportunities`, `influencer_company_profile`,
//   `influencer_analyses`, `influencer_posts`, `influencer_comments`,
//   `influencer_campaigns`, `influencer_income`) deixa de ser estritamente pessoal:
//   nova policy `Marketing team can view all *` permite leitura para qualquer usuário
//   com permissão na tela `marketing_social` (validada via função SECURITY DEFINER
//   `has_marketing_social_access(uuid)` que faz semi-join em
//   `usuario_permissoes_telas`/`telas_sistema` e respeita admin via `has_role`).
//   Escritas (INSERT/UPDATE/DELETE) seguem restritas ao dono original — nenhuma
//   alteração de governança de mutação. Frontend (`InfluencerDashboard`,
//   `AutopilotMiningPanel`, `InfluencerSuggestionsPanel`) deixa de filtrar
//   leituras por `user_id`, passando a usar exclusivamente RLS para visibilidade.
//   `PainelDialog` agora cria painéis com `compartilhado=true` por padrão e copy
//   ajustada para refletir caráter colaborativo. Sem mudança de schema em
//   `influencer_paineis` (RLS já contemplava `compartilhado`).
// PR-65 (v3.4.31): PWA/Login — atualização automática da versão no login.
//   O fluxo de autenticação passa a forçar uma navegação limpa pós-login para
//   o destino correto (`/dashboard` ou portal do cliente), limpando Cache
//   Storage, desregistrando Service Workers antigos e adicionando cache-buster
//   na URL. O PWA também passa a aplicar novos Service Workers automaticamente,
//   reduzindo drift de bundles em apps instalados. Sem alteração de backend.
// PR-64 (v3.4.29): Central de Trabalho — Restaura o card "Resumo da semana"
//   (KPIs Concluídas/Produtividade/Planejadas + gráfico "Conclusões por dia
//   — semana atual vs anterior") no topo da aba Lista do `MinhasTarefasContent`.
//   O componente `ResumoSemanal` existia mas não estava montado em nenhum
//   container ativo desde a v3.4.x. Adicionado botão "Ocultar resumo" /
//   "Mostrar resumo" na action bar (visível apenas em view=list) e um botão
//   "Ocultar" dentro do próprio card via prop opcional `onHide`. A escolha
//   é persistida por usuário via nova coluna
//   `user_central_preferences.show_weekly_summary boolean default true`,
//   seguindo o mesmo padrão de autosave debounced + realtime sync dos demais
//   filtros. Renderização condicional: somente quando `view === "list"` E
//   `showWeeklySummary === true` (Quadro/Calendário/Dashboard mantêm-se
//   sem o card, sem regressão). Sem invalidações adicionais — o setQueryData
//   no onSuccess do save preserva o fix anti-flicker da v3.4.28.
//   e por janela de `data_conclusao`. As RPCs `diag_tarefas_sem_data_conclusao_resumo`
//   e `diag_tarefas_sem_data_conclusao` foram estendidas com três novos parâmetros
//   opcionais: `p_status text[]` (default ARRAY['concluida'] preserva comportamento
//   histórico), `p_conclusao_from date` e `p_conclusao_to date` (filtram por
//   `data_conclusao` da tarefa, complementando o filtro existente sobre
//   `updated_at`). UI da página `DiagnosticoTarefasDataConclusao` ganhou:
//   (a) `StatusMultiSelectFilter` (Popover + checkboxes para concluída/em
//   andamento/pendente, default = ['concluida']); (b) segundo `DateRangeFilter`
//   rotulado "Concluídas em" enquanto o existente passou a ser rotulado
//   "Atualizadas em"; (c) botão "Limpar" reseta os 3 filtros adicionais; (d)
//   `CardDescription` do detalhamento exibe os filtros aplicados. RLS inalterado
//   (admin-only). Sem mudança em `backfill_data_conclusao_tarefas`. Permite
//   isolar casos recorrentes cruzando status e janela de conclusão.
// PR-61 (v3.4.25): Diagnóstico de tarefas — Botão "Executar backfill agora".
//   Novo controle no header da tela `DiagnosticoTarefasDataConclusao` que
//   dispara `supabase.rpc('backfill_data_conclusao_tarefas', { p_source:
//   'manual_admin_ui' })` após confirmação em `AlertDialog`. O modal mostra
//   contagem atual de órfãs, descreve a estratégia chunked (lotes de 500 +
//   FOR UPDATE SKIP LOCKED, cap 100k/execução), reforça idempotência e que
//   toda execução é registrada em `projeto_tarefas_backfill_log` (origem
//   `manual_admin_ui` — distinta do cron diário). Estados visuais: botão
//   `default` quando há órfãs e `outline` quando zero, loading com
//   `Loader2 animate-spin` durante a chamada, refetch automático das
//   queries de resumo/detalhe ao concluir, toast de sucesso com
//   linhas/duração ou de erro (mensagem diferenciada para "Acesso negado").
//   Sem alteração no backend — reaproveita a função SECURITY DEFINER já
//   existente (PR-60) com proteção admin via GRANT.
// PR-59 (v3.4.23): Painel admin — Status dos jobs automáticos de tarefas.
//   Novo widget `AdminCronStatusPanel` (em `src/components/admin/`) renderizado
//   no topo da aba "Incidentes" do `SecurityEventExplorer`. Mostra, para cada
//   job agendado: badge ativo/inativo, schedule cron, status da última
//   execução (sucesso/falha/em execução/sem execução) com badge colorida,
//   timestamp absoluto + relativo (`formatDistanceToNow`), e mensagem de erro
//   quando a última execução não foi `succeeded`. Botão "Detalhes" leva às
//   telas dedicadas (Histórico do Backfill, Checagem Semanal). Refetch
//   automático a cada 60s + botão manual. Nova RPC SECURITY DEFINER
//   `admin_tarefas_cron_status` (admin-only, search_path inclui `cron`)
//   consulta `cron.job` + `cron.job_run_details` (LATERAL JOIN limitado a 1
//   por job) para os jobs `backfill-data-conclusao-tarefas-daily` e
//   `consistency-check-tarefas-data-conclusao-weekly`. Tokens semânticos
//   exclusivamente (`bg-success/20`, `text-destructive`, `bg-muted/20`).
// PR-58 (v3.4.22): Tarefas — Checagem semanal automatizada de consistência.
//   Nova rota admin `/dashboard/admin/checagem-semanal-tarefas` que monitora
//   a integridade entre `status='concluida'` e o preenchimento de
//   `data_conclusao` em `projeto_tarefas`. Cron job pg_cron
//   `consistency-check-tarefas-data-conclusao-weekly` (todas as segundas
//   03:00 UTC) executa `consistency_check_tarefas_data_conclusao('cron')`,
//   que: (a) conta total/com/sem `data_conclusao`; (b) calcula % de
//   inconsistência; (c) quando há órfãs, abre incidente em
//   `security_incidents` (`incident_type='task_data_conclusao_inconsistency'`,
//   severidade proporcional: low/medium/high baseada em volume e %), com
//   `top_offenders` por responsável anexado em `related_events`;
//   (d) atualiza incidente existente em vez de duplicar; (e) resolve
//   automaticamente quando órfãs voltam a zero. Nova tabela
//   `projeto_tarefas_consistency_check_log` (RLS admin-only SELECT, sem
//   INSERT/UPDATE/DELETE público — apenas SECURITY DEFINER escreve) guarda
//   histórico com KPIs por execução. Três RPCs admin:
//   `consistency_check_tarefas_resumo` (KPIs + última execução +
//   incidentes_abertos), `consistency_check_tarefas_listar` (histórico
//   filtrado por janela de datas, hard-cap 1000), `consistency_check_tarefas_run_now`
//   (botão "Executar agora"). UI: banner verde/amarelo conforme
//   incidentes abertos, 4 KPI cards, tabela com badge por origem (cron/manual)
//   e flag de incidente. Links cruzados foram adicionados nas telas de
//   Diagnóstico e Histórico do Backfill. Tokens semânticos exclusivamente
//   (`text-success`, `text-warning`, `text-destructive`, `bg-warning/5`).
// PR-57 (v3.4.21): Tarefas — Alertas configuráveis para o job de backfill.
//   Nova rota admin `/dashboard/admin/alertas-backfill-tarefas` que permite
//   configurar quando administradores devem ser notificados pelo job
//   `backfill_data_conclusao_tarefas`. Duas tabelas governadas (RLS admin):
//   `projeto_tarefas_backfill_alert_config` (single-row, com `enabled`,
//   `threshold_orfas`, `cooldown_minutes`, `notify_admins` e
//   `extra_recipient_ids uuid[]`) e `projeto_tarefas_backfill_alerts`
//   (histórico append-only de disparos com tipo, contagem, destinatários).
//   A função `backfill_data_conclusao_tarefas` foi reescrita para:
//   (a) pré-contar órfãs antes do UPDATE, (b) registrar `error` no log e
//   disparar alerta `error` em caso de exceção (sem reraise — não derruba o
//   cron), (c) disparar alerta `threshold_exceeded` quando órfãs ≥ limite.
//   Helper interno `_dispatch_backfill_alert` insere notificações in-app
//   (tabela `notifications`, type=`backfill_alert`) para todos os admins +
//   destinatários extras, com cooldown por `alert_type` para evitar spam.
//   Aproveita a infra `useNotifications` (toast + push) sem novo template
//   de email. Três RPCs admin: `backfill_alert_config_get`,
//   `backfill_alert_config_update` e `backfill_alerts_listar`. UI com
//   Switch global, threshold/cooldown, picker de destinatários (Popover +
//   Command), histórico tabular e cards de status. Links cruzados foram
//   adicionados nas telas de Diagnóstico e Histórico do Backfill.
// PR-56 (v3.4.20): Tarefas — Histórico de execuções do job de backfill.
//   Nova rota admin `/dashboard/admin/historico-backfill-tarefas` que consome
//   duas RPCs `SECURITY DEFINER` (admins apenas):
//   (1) `diag_backfill_log_resumo(p_date_from, p_date_to)` — KPIs agregados
//   (total de execuções, tarefas corrigidas, duração média/máxima, primeira
//   e última execução, breakdown por origem em JSONB).
//   (2) `diag_backfill_log_listar(p_date_from, p_date_to, p_source, p_limit)`
//   — listagem ordenada por `executed_at DESC` com filtros de período,
//   origem (cron/manual/trigger) e limite (50–1000, hard-cap server-side).
//   UI: KPIs, breakdown por origem em cartões, tabela com badge por canal,
//   detalhes JSON expansíveis por linha (Collapsible) e exportação CSV
//   client-side. Reuso de `DateRangeFilter` e tokens semânticos
//   (`text-success`, `text-muted-foreground`, `bg-muted/20`); zero hardcode.
//   Correção colateral: a função `diag_tarefas_sem_data_conclusao_resumo`
//   (PR-55) referenciava `created_at` na tabela de log, mas a coluna real é
//   `executed_at`. Foi recriada com a referência correta — KPI "Último
//   backfill" da tela de diagnóstico volta a popular sem depender da próxima
//   execução do job.
// PR-55 (v3.4.19): Tarefas — Tela de diagnóstico admin para `data_conclusao`.
//   Nova rota `/dashboard/admin/diagnostico-tarefas-data-conclusao` (restrita
//   ao screenCode `admin`) que consome duas RPCs `SECURITY DEFINER` blindadas
//   por `has_role('admin')`:
//   (1) `diag_tarefas_sem_data_conclusao_resumo(p_date_from, p_date_to)` —
//   KPIs globais (concluídas no período, órfãs, %, responsáveis afetados,
//   última execução do job de backfill).
//   (2) `diag_tarefas_sem_data_conclusao(p_date_from, p_date_to)` —
//   detalhamento por responsável (nome, e-mail, totais, % e data da última
//   órfã), ordenado pelas piores ofensoras.
//   UI: cards de KPI + banner de status (verde quando 0 órfãs, amarelo
//   quando há pendências), tabela responsiva com busca por nome/e-mail e
//   reuso do `DateRangeFilter` para janela arbitrária. Tokens semânticos
//   exclusivamente (`text-success`, `text-warning`, `text-destructive`,
//   `bg-success/5`, etc.); zero hardcode.
//   Permissões: a tela aciona `RAISE EXCEPTION` em não-admins; o frontend
//   detecta `Acesso negado` e mostra um card explicativo em vez de quebrar.
//   Operacional: permite ao time acompanhar o saneamento sem precisar abrir
//   o banco — fecha o ciclo iniciado em PR-51 (trigger), PR-52 (job diário),
//   PR-53 (fallback no widget) e PR-54 (seletor de período).
// PR-54 (v3.4.18): Tarefas — Seletor de período (7/14/30 dias) no
//   `WidgetTimelineConclusoes`. O widget passou a aceitar três janelas
//   configuráveis pelo usuário via toggle compacto na header (estado local
//   `windowDays`, default 14d). Benefícios: (1) destrava a leitura semanal
//   (7d) sem mudar o comportamento histórico de quem já usa 14d; (2) abre
//   visão de tendência mensal (30d) enquanto o backfill/trigger consolidam
//   `data_conclusao`; (3) reduz dependência de uma única janela enquanto a
//   base é normalizada. O `useMemo` agora depende de `windowDays`, e os
//   textos da header, vazio e tooltip refletem a janela ativa. Tokens
//   semânticos (`bg-muted/40`, `bg-background`, `text-muted-foreground`)
//   garantem aderência ao design system; sem cores hardcoded.
// PR-53 (v3.4.17): Tarefas — Fallback defensivo no `WidgetTimelineConclusoes`.
//   Mesmo com o trigger `trg_sync_tarefa_data_conclusao` (PR-51) e o job
//   diário `backfill-data-conclusao-tarefas-daily` (PR-52) garantindo a
//   integridade de `data_conclusao`, o widget passou a aplicar fallback para
//   `updated_at` quando o campo oficial estiver vazio. Isso garante que o
//   gráfico continue exibindo dados em janelas de transição (importações em
//   massa, restores parciais, RPCs novos que escapem do trigger por minutos),
//   sem regressão visual.
//   (1) Lógica em `useMemo`: para cada tarefa concluída, prioriza
//   `data_conclusao`; se nulo, usa `updated_at` como `referenceDate` e
//   incrementa um contador `fallbackUsed` para auditoria visual.
//   (2) Indicador discreto: quando `fallbackCount > 0`, um badge
//   `~N aprox.` aparece ao lado do total na header do widget (token
//   `bg-warning/15 text-warning`), com `title` explicando que a referência é
//   aproximada. Em condições normais (todos os dados corretos), o badge não
//   aparece — zero ruído visual.
//   (3) Tooltip do botão `Info` ampliado para explicar o critério primário
//   (data de conclusão oficial) e o critério secundário (última atualização
//   como aproximação).
//   (4) Validação de data: ignora `referenceDate` com `isNaN(getTime())` para
//   blindar contra strings de data corrompidas vindas do banco.
//   Resultado: o gráfico Timeline Conclusões agora tem 4 camadas de garantia —
//   frontend (mutations setam `data_conclusao`), trigger (interceptação no
//   banco), job diário (auditoria), widget com fallback (resiliência visual).
// PR-52 (v3.4.16): Tarefas — Job recorrente de backfill de `data_conclusao` (defesa em profundidade).
//   Mesmo com o trigger `trg_sync_tarefa_data_conclusao` (PR-51) garantindo a
//   integridade do campo `data_conclusao` em todos os caminhos transacionais,
//   foi adicionado um job autônomo de auditoria para cobrir cenários atípicos
//   (importações em massa fora do trigger, restores parciais, scripts ad-hoc
//   ou migrações futuras que possam reabrir a brecha).
//   (1) Função `backfill_data_conclusao_tarefas(p_source text)`
//   (`SECURITY DEFINER`, `search_path = public`): varre `projeto_tarefas`
//   procurando registros com `status = 'concluida'` e `data_conclusao IS NULL`,
//   preenche o campo com `COALESCE(updated_at, created_at, now())` e retorna
//   a quantidade corrigida. `EXECUTE` revogado de PUBLIC; concedido apenas a
//   `authenticated` e `service_role`.
//   (2) Tabela `public.projeto_tarefas_backfill_log` (campos: rows_updated,
//   duration_ms, source, details jsonb) com RLS habilitado e política de
//   `SELECT` restrita a `has_role('admin')`. Sem políticas de write — toda
//   inserção parte da função `SECURITY DEFINER`. Cada execução com órfãs
//   encontradas é gravada; execuções vazias geram no máximo 1 heartbeat por
//   dia para deixar pulso sem inflar a tabela.
//   (3) Cron job diário `backfill-data-conclusao-tarefas-daily` agendado via
//   `pg_cron` para `0 3 * * *` (03:00 UTC, baixa carga). Extensões `pg_cron`
//   e `pg_net` habilitadas no schema `extensions`. Idempotente: o agendamento
//   remove versão anterior antes de criar a nova.
//   (4) Validação: execução manual confirmou 0 órfãs (banco continua íntegro
//   após o backfill do PR-51) e o heartbeat foi gravado em
//   `projeto_tarefas_backfill_log` com `duration_ms = 4`. Cron está ativo
//   (`cron.job.active = true`).
//   Resultado: o pipeline de dados do gráfico Timeline Conclusões agora tem
//   três camadas de garantia — frontend (mutations setam `data_conclusao`),
//   trigger (interceptação no banco) e job diário (auditoria/correção).
// PR-51 (v3.4.15): Central de Trabalho — Correção do gráfico "Timeline Conclusões".
//   Diagnóstico: a aba `Dashboard` em Minhas Tarefas mostrava o gráfico vazio
//   porque o widget `WidgetTimelineConclusoes` filtra por `data_conclusao` na
//   janela dos últimos 14 dias, e 64% das tarefas concluídas (637 de 991) estavam
//   sem esse campo preenchido — não existia nenhum trigger no banco garantindo a
//   integridade do dado e os caminhos de conclusão pelo frontend (board, calendário,
//   sync Asana, RPCs de massa) não setavam o campo de forma uniforme.
//   (1) Migration: criada a função `sync_tarefa_data_conclusao()` e o trigger
//   `trg_sync_tarefa_data_conclusao` (BEFORE INSERT OR UPDATE OF status,
//   data_conclusao em `projeto_tarefas`). Quando uma tarefa transita para
//   `status = 'concluida'` e `data_conclusao` está nula, o campo é preenchido
//   com `now()`. Quando sai de `concluida`, o campo é limpo. Quando uma update
//   chega sem data mas a tarefa já estava concluída, a data anterior é preservada.
//   Cobre todos os caminhos de mutação (UI, board, calendário, RPCs, Asana sync)
//   sem depender da disciplina do frontend.
//   (2) Backfill: executado `UPDATE` em `projeto_tarefas` para todas as 637
//   tarefas concluídas órfãs, populando `data_conclusao` com
//   `COALESCE(updated_at, created_at, now())`. Após a migração: 991/991 tarefas
//   concluídas têm `data_conclusao` (0 sem data).
//   (3) `WidgetTimelineConclusoes` reescrito: migrado de `LineChart` para
//   `AreaChart` com gradient (alinhado ao `TaskEvolutionChart` do módulo
//   Projetos), header compacto exibindo o total de conclusões na janela e botão
//   de info com tooltip explicando o critério ("agrupadas pela data de
//   conclusão, janela de 14 dias corridos"). Adicionado estado vazio amigável
//   (`Activity` + mensagem orientativa) que aparece quando o usuário ainda não
//   concluiu nada na janela, em vez da linha plana sem contexto da versão
//   anterior. Tooltip do gráfico passou a usar tokens `--popover` para coerência
//   visual em qualquer cor de fundo escolhida no módulo Projetos.
//   Resultado: o gráfico volta a refletir o histórico real de conclusões e
//   passa a registrar automaticamente toda nova conclusão, independentemente
//   do caminho de UI usado.
// PR-50 (v3.4.14): Central de Trabalho — Removido o acompanhamento semanal residual.
//   (1) `CentralKPIs` (aba Tarefas): substituído o KPI "Produtividade semanal"
//   por "Para hoje", eliminando a métrica agregada de semana que duplicava o
//   contexto já entregue por outros indicadores e poluía a faixa superior.
//   (2) `MinhasTarefasContent`: removido o painel `<ResumoSemanal>` que ainda
//   aparecia acima da lista de tarefas (linha + sparkline semana atual vs
//   anterior), atendendo o pedido recorrente de eliminar a "informação
//   repetida". O componente `ResumoSemanal` segue no repositório (pode ser
//   reaproveitado em outras telas), mas não é mais montado na Central.
//   (3) Imports `TrendingUp`, `startOfWeek`, `endOfWeek`, `isWithinInterval`
//   e o cálculo de `produtividade/concluidasSemana/totalSemana` foram
//   removidos do `CentralKPIs` para manter o componente enxuto.
//   Resultado: a Central foca em execução imediata (Pendentes, Para hoje,
//   Atrasadas, Concluídas hoje, Não lidas) — sem cards/painéis semanais
//   misturando análise de tendência com operação do dia.
// PR-49 (v3.4.13): Vincular China — Identidade visual unificada com Central de Trabalho.
//   (1) `VincularChinaKpis` migrado dos Cards customizados (com `bg-*/5` cru,
//   ícones inline e altura variável que causava serrilha vertical) para o
//   componente global `KpiCard` (`src/components/ui/kpi-card.tsx`), o mesmo
//   usado em `CentralKPIs`. Cada KPI ganha variante semântica (`info`,
//   `warning`, `success`, `destructive`, `default`) que respeita os tokens
//   derivados por `getBgPaletteVars` em qualquer cor de fundo escolhida no
//   módulo Projetos — o "bg-warning/10" do KpiCard é recolorido pela paleta
//   custom, mantendo harmonia visual em fundos pastel ou escuros (eliminando
//   o contraste estranho dos `bg-*/5` fixos da versão anterior).
//   (2) Altura mínima uniforme `min-h-[112px]` herdada do `KpiCard` —
//   eliminada a diferença de altura que existia entre cards com e sem ícone.
//   (3) Estado ativo (KPI selecionado para filtrar) padronizado em
//   `ring-2 ring-primary ring-offset-1` (mesmo padrão da Central), aplicado
//   via prop `className` do `KpiCard`.
//   (4) Grid responsivo mobile-first:
//   `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3` (antes
//   `grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2`) — em mobile cada KPI
//   ganha mais espaço para o valor numérico e ícone do `KpiCard` sem comprimir.
//   (5) `ProjetoVincularChina` ganha header reorganizado em duas linhas
//   (Linha 1: Breadcrumb + actions; Linha 2: hero com ícone-chip, título,
//   progresso e seletor de projeto), espelhando a estrutura de `CentralTrabalho`.
//   Removido o botão `ArrowLeft` "voltar" redundante (a sidebar já cobre essa
//   navegação, idêntico à Central) e os imports de `ArrowLeft`/`useNavigate`
//   foram limpos para evitar warnings.
//   (6) Padding do container migrado de `p-6` para `p-4 sm:p-6` (mobile-first,
//   alinhado com `CentralTrabalho`), preservando `space-y-4` para ritmo vertical
//   consistente. Resultado: a tela "Vincular China" agora tem identidade visual
//   indistinguível da Central de Trabalho — KPIs uniformes, header padronizado,
//   paleta dinâmica que conversa com cards e tabelas em qualquer cor de fundo.
// PR-48 (v3.4.12): Projetos — Largura total (full-width) em todas as telas do módulo.
//   Removidos os limites `max-w-[1400px]` (Projetos), `max-w-6xl` (Central de
//   Trabalho e Minha Equipe) e `max-w-[1600px]` (Vincular China). Containers
//   agora usam `w-full`, ocupando 100% do espaço disponível ao lado da sidebar
//   em monitores ultrawide. Padding mantido (`p-4 sm:p-6` / `p-6`) para preservar
//   respiro nas bordas. Bump de versão força invalidação do cache para garantir
//   que clientes com a build anterior recebam imediatamente os novos KPIs e
//   layout sem precisar limpar cache manualmente.
// PR-47 (v3.4.11): Projetos — Identidade visual unificada e cor de fundo global.
//   (1) `usePageBgColor` refatorado para usar UMA chave compartilhada
//   (`projeto_module_bg`) em vez de uma chave por página. Mantém a mesma API
//   (`pageKey` continua aceito, mas é ignorado), então as telas existentes
//   (Projetos, ProjetosMinhaEquipe, CentralTrabalho, ProjetoVincularChina,
//   ProjetosVisualQA) seguem chamando `usePageBgColor("...")` sem alterações
//   e passam a ler/escrever no mesmo slot. Resultado: a cor escolhida em
//   qualquer tela do módulo é aplicada imediatamente em todas as outras e
//   persiste entre sessões.
//   (2) Sincronização cross-tab e in-app: o hook escuta o evento `storage`
//   (sincroniza entre abas) e um `CustomEvent('projeto-module-bg-change')`
//   despachado pelo próprio `setBgColor` (sincroniza entre componentes da
//   mesma aba que rendam telas distintas no mesmo render-tree). Eliminado o
//   bug onde alterar a cor em uma tela exigia recarregar para refletir nas
//   outras.
//   (3) `ProjetoVincularChina` recebe o mesmo wrapper visual das demais telas
//   do módulo: `SidebarProvider` + `AppSidebar` + `<main>` com paleta dinâmica
//   (`getBgPaletteVars(bgColor)`), Breadcrumb (Dashboard › Projetos › Vincular
//   China), `SidebarTrigger` e `ProjetoBgColorPicker` no canto superior. Agora
//   a tela tem identidade visual idêntica a Projetos/Minhas Tarefas e respeita
//   a cor global escolhida pelo usuário (cards, KPIs, tabelas, side panel
//   herdam a paleta automaticamente via cascata de custom properties).
//   (4) `ProjetosVisualQA` migrado de `useState` local para `usePageBgColor`,
//   permitindo testar com a cor real do módulo (em vez de um sandbox isolado).
// PR-46 (v3.4.10): Visual QA — página interna `/dashboard/projetos/visual-qa`.
//   Sandbox para validar visualmente cores de fundo (`getBgPaletteVars`) em
//   Cards, Tabelas, KPIs, Tabs, Inputs, Botões, Badges, Alert e estados
//   loading/empty. Inclui medidor ao vivo de contraste WCAG AA mostrando
//   ratios de texto/fundo, texto/card, muted/fundo e borda/fundo, com badges
//   ✓/✗ contra os mínimos 4.5:1 (texto) e 3:1 (UI). 9 atalhos de cor rápida
//   cobrindo branco, areia, teal médio, magenta, cinza 50% e dois pretos.
// PR-45 (v3.4.9): Acessibilidade — Contraste WCAG AA automático em fundos custom.
//   `src/lib/colorUtils.ts` ganha motor de validação/ajuste de contraste:
//   (1) `luminanceFromHsl(h,s,l)` calcula luminância relativa sRGB (WCAG 2.1).
//   (2) `pickForegroundL(surface, fg, minRatio)` faz busca bidirecional —
//   testa direção dark E light, escolhe a que atinge o threshold (ou a melhor
//   tentativa se ambas falham). Resolve fundos de luminância média (#E91E78,
//   #4A9988, #808080) onde branco/preto sozinho não atingia 4.5:1.
//   (3) Cada token de texto agora é resolvido contra a SUPERFÍCIE específica:
//   `--card-foreground` mira `--card` (não `--background`), `--accent-foreground`
//   mira `--accent`, etc. Antes a paleta usava lightness fixos (12, 96…) e
//   quebrava em cores intermediárias.
//   (4) `--border`/`--input` resolvidos com 3:1 (WCAG 1.4.11 UI components),
//   depois suavizados (mistura 55/45 com a superfície) e revalidados — borda
//   visível mas sem competir com o texto.
//   (5) Saturações de texto cortadas a 18% (corpo) e 14% (muted) para evitar
//   texto colorido vibrante difícil de ler. Saturações de superfície a 35%.
//   Validado contra 8 hex de teste (#FFFFFF/#0F1623/cinza médio/saturados):
//   100% das combinações texto/fundo ≥4.5:1, todas bordas ≥3.0:1.
// PR-44 (v3.4.8): Responsividade — Tabelas e cards adaptáveis com rolagem horizontal.
//   (1) Primitivo `<Table>` ganha API ampliada: `stickyHeader` (thead `position:sticky` +
//   `max-h-[70vh]` + backdrop blur), `minWidthClass` (default `min-w-[640px]`) e
//   `wrapperClassName`. Wrapper aplica `overflow-x-auto` SEMPRE (acionado quando
//   `min-w-[640px]` excede o viewport) e scrollbar fina via `::-webkit-scrollbar:h-2`
//   estilizada com `bg-border` (combina com a paleta custom). Resultado: em telas
//   menores que 640px a tabela ganha rolagem lateral nativa em vez de comprimir
//   colunas (que causava colisão de texto).
//   (2) `TableHead` ganha `whitespace-nowrap` para garantir que rótulos do cabeçalho
//   nunca quebrem em duas linhas e desalinhem com as células abaixo.
//   (3) `CentralKPIs`: grid muda de `grid-cols-2 lg:grid-cols-4` para
//   `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` — em mobile (<640px) cada KPI ocupa
//   linha inteira (legibilidade), tablet 2 colunas, desktop 4. Combinado com o
//   `min-h-[112px]` do PR-42, garante alinhamento visual em qualquer breakpoint.
//   (4) `MinhasTarefasContent` (sub-tabs Lista/Quadro/Calendário/Dashboard): TabsList
//   ganha `overflow-x-auto max-w-full` + `[&::-webkit-scrollbar]:hidden` e cada Trigger
//   `shrink-0` — em telas estreitas, vira faixa rolável em vez de quebrar/cortar.
//   (5) `CentralTrabalho`: container muda de `p-6` para `p-4 sm:p-6` (mobile-first
//   padding). Breadcrumb ganha `overflow-x-auto` + `BreadcrumbList flex-nowrap` —
//   evita quebra do trail em mobile (Dashboard › Projetos › Central › Tarefas › ...).
// PR-43 (v3.4.7): Tabelas — Alinhamento com Cards e harmonia em fundos custom.
//   `src/components/ui/table.tsx` (primitivo shadcn) recebe padronização visual
//   global para conversar com Cards em qualquer paleta:
//   (1) Wrapper `Table` ganha `bg-card` + `border border-border/60` + `rounded-md`,
//   replicando o "container" dos Cards. Sob fundos custom, `--card` e `--border`
//   são reescritos por `getBgPaletteVars`, então a tabela inteira herda a paleta
//   automaticamente sem parecer "colada" sobre o fundo.
//   (2) `TableHeader` ganha `bg-muted/40` + `[&_tr]:border-border/60` para
//   diferenciação clara do body em qualquer cor de fundo (antes era transparente
//   e sumia em fundos pastel).
//   (3) `TableHead` e `TableCell` compartilham `px-4 py-3` (alinhamento pixel-a-
//   pixel das colunas vertical e horizontalmente). `TableHead` mantém `h-11` para
//   ritmo vertical consistente com a Central (h-9 inputs / h-11 header / h-12 KPI).
//   (4) `TableHead` muda de `font-medium` para `text-xs font-semibold uppercase
//   tracking-wide` — diferenciação tipográfica clara entre header e células,
//   padrão de tabelas profissionais (estilo SaaS B2B).
//   (5) `TableRow` hover passa de `bg-muted/50` para `bg-muted/40` e selected de
//   `bg-muted` para `bg-muted/60` — combina com a opacity do header e mantém
//   contraste em fundos escuros + claros.
//   (6) `TableFooter` segue o mesmo `bg-muted/40 border-border/60`.
//   Resultado: qualquer tela usando o primitivo `<Table>` (ContaPagar, Contas
//   Receber, Estoque, Painel AP, etc.) ganha consistência imediata com cards e
//   se adapta sozinha ao fundo escolhido pelo usuário via ProjetoBgColorPicker.
// PR-42 (v3.4.6): Central de Trabalho — Padronização de paddings, gaps e alturas.
//   Eliminada a sensação de desalinhamento entre seções normalizando tokens visuais:
//   (1) `KpiCard` ganha `min-h-[112px]` e `CardContent` flex h-full para que todos os
//   cards tenham a MESMA altura mesmo quando subtitle/trend variam — antes, cards sem
//   trend ficavam mais baixos que cards com trend, criando a serrilha visual.
//   (2) Container da Central muda `space-y-5` → `space-y-4` (ritmo vertical consistente
//   com o `space-y-4` interno das abas) e Breadcrumb ganha `min-h-[28px]` para evitar
//   "salto" quando o conteúdo da rota muda.
//   (3) TabsList principal padronizada em `h-10` com TabsTrigger `h-8 px-3` — mesma
//   altura percebida dos botões `size="sm"` (h-9) com folga de 1px do background.
//   (4) `MinhasTarefasContent`: action bar com `min-h-[36px]`, botão "Nova Tarefa" e
//   sub-tabs (Lista/Quadro/Calendário/Dashboard) movidos de `h-8` para `h-9`/`h-7`
//   internos, igualando inputs/selects de filtro (também subidos de `h-8` para `h-9`).
//   Larguras dos selects ajustadas (130→140, 160→170) para acomodar o novo padding sem
//   truncar labels. Gap dos filtros `gap-3` → `gap-2` (mais compacto, menos "vazios").
//   (5) `ResumoSemanal` alinhado com `KpiCard`: `p-5` → `p-4`, `space-y-5` → `space-y-4`.
//   (6) `TabsContent mt-5` → `mt-4` para criar espaçamento simétrico com `space-y-4`.
//   Resultado: KPIs, breadcrumb, tabs, filtros e cards compartilham o mesmo grid
//   vertical (4×4) e horizontal (gap-2/h-9), eliminando microdesalinhamentos.
// PR-41 (v3.4.5): Central de Trabalho — Painel "Resumo da semana" com tendência semanal.
//   Novo componente `ResumoSemanal` (src/components/projetos/central/ResumoSemanal.tsx)
//   renderizado no topo da view "Lista" da aba Tarefas, mostrando evolução semana atual x
//   semana anterior (ISO weekStartsOn:1). Métricas: Concluídas, Produtividade
//   (concluídas/planejadas com prazo na semana, %) e Planejadas. Cada bloco exibe valor
//   atual, valor da semana anterior, delta percentual e ícone de tendência (TrendingUp/Down/
//   Minus) colorido por melhoria (success se higherIsBetter && up, destructive caso contrário).
//   Inclui sparkline LineChart (recharts) com conclusões dia-a-dia da semana atual (linha
//   primary sólida) sobreposta à semana anterior (linha muted tracejada) para leitura imediata
//   da curva. Tudo em uma única passagem de `useMemo` sobre `tarefas` com `date-fns`
//   (startOfWeek/endOfWeek/isWithinInterval/eachDayOfInterval) sem fetch adicional — usa o
//   array já carregado por `useMinhasTarefas`. Resolve a queixa de "só vejo o total atual,
//   não vejo se estou melhorando ou piorando".
// PR-40 (v3.4.4): Central de Trabalho — Atalho "Ordenar por urgência" no card Atrasadas.
//   Novo schema de URL `sort` (valores: `default` | `urgent`) em `centralUrlParams.ts` com
//   normalização, sanitização e parser unificado. `setTab` em CentralTrabalho aceita
//   `extras.sort` e propaga via URL ao trocar de aba/clicar nos KPIs. O card "Atrasadas" do
//   `CentralKPIs` (presente nas 3 abas: hoje/tarefas/inbox) agora navega para
//   `?tab=tarefas&filter=atrasadas&sort=urgent`, levando o usuário direto à lista atrasada
//   já reordenada por prioridade desc (urgente > alta > média > baixa) e, em empate, por
//   `data_prazo` ascendente (próxima ação) e `created_at` como tiebreaker estável.
//   `MinhasTarefasContent` lê `sort` reativamente da URL, troca a agrupação default por uma
//   única seção plana ("Atrasadas — por urgência e prazo") quando ativo, e exibe banner com
//   botão "Limpar ordenação" para voltar ao agrupamento padrão (Atrasadas/Hoje/Esta semana/
//   Mais tarde/Sem data/Concluídas). Subtitle do KPI atualizado para "por urgência e prazo".
// PR-39 (v3.4.3): Projetos — Cor de fundo customizada agora harmoniza com cards/inputs.
//   Antes, alterar a cor de fundo via `ProjetoBgColorPicker` recolorava só o `<main>`,
//   deixando Cards (`bg-card`), KPIs, inputs e breadcrumb com tokens fixos do tema — daí
//   a sensação de "fundo não conversa" relatada. Novo helper `getBgPaletteVars(hex)` em
//   `src/lib/colorUtils.ts` deriva uma paleta HSL coerente da cor escolhida e devolve um
//   mapa de variáveis CSS (--background, --foreground, --card, --popover, --muted,
//   --border, --input, --secondary, --accent + foregrounds) que sobrescreve os tokens do
//   shadcn no escopo do `<main>`. Em fundos claros: cards ligeiramente mais claros que a
//   superfície, bordas suaves; em fundos escuros: superfícies levemente elevadas, texto
//   claro com saturação contida. Aplicado em CentralTrabalho, Projetos, ProjetosMinhaEquipe
//   e ProjetoDetalhe (cobrindo todas as telas com o picker). Nenhum componente filho precisa
//   ser alterado — a cascata via custom properties já recolore Card, Input, Button(secondary),
//   Badge, Tabs, Separator etc. automaticamente.
// PR-38 (v3.4.2): Central de Trabalho — KPIs contextuais por aba (sem duplicação visual).
//   `CentralKPIs` agora recebe `activeTab` e renderiza um conjunto distinto de métricas para
//   cada aba: "Hoje" foca em ação imediata (Para hoje / Atrasadas / Concluídas hoje / Não lidas),
//   "Tarefas" foca em gestão da carga (Pendentes / Atrasadas / Concluídas hoje / Produtividade
//   semanal — com cor variando por faixa), e "Inbox" foca em notificações + atalhos para as
//   filas relevantes. Métricas calculadas em um único `useMemo` sobre `useMinhasTarefas`.
//   `MinhasTarefasContent` deixa de renderizar o `<MinhasTarefasKPIs />` interno (era a fonte
//   da duplicação observada: Pendentes/Atrasadas/Concluídas hoje apareciam duas vezes na mesma
//   tela). Cards seguem clicáveis quando há filtro destino correspondente.
// PR-37 (v3.4.1): Bimaster Studio — Recuperação de designs vazios do Stitch.
//   Edge function `stitch-proxy` ganha action `refresh_design` que recebe um designId,
//   valida ownership (user_id), busca o screen no Stitch via `get_screen` (projectId+screenId
//   armazenados na geração inicial), reaplica `extractScreenData`, resolve URLs de htmlCode
//   com retry exponencial (3 tentativas, backoff 1.5s/3s) e atualiza apenas os campos
//   ausentes (html_code se vazio/<50 chars, preview_url se nulo). Retorna 200 com
//   {success:false, error} quando ainda não há conteúdo no Stitch — não derruba o card.
//   StitchDesignStudio: cards sem html_code nem preview_url agora exibem ícone de aviso
//   + texto "Conteúdo não disponível" + botão "Atualizar" (chama refresh_design) quando
//   há screen_id; o DesignPreview também recebe `onRegenerate` apontando para o mesmo
//   handler. Resolve casos onde a extração assíncrona do Stitch falhou na primeira tentativa
//   e o design ficou salvo sem conteúdo visível.
//   Novo componente `NarracaoTimeline` (src/components/marketing/studio/NarracaoTimeline.tsx)
//   que segmenta o texto da narração em sentenças (split por .!?… e subdivisão por ,;: para
//   frases >140 chars) e calcula timestamps proporcionais à contagem de palavras de cada
//   segmento sobre a duração real do áudio MP3 (lida via HTMLAudioElement.loadedmetadata).
//   Exibe player próprio (play/pause/restart), barra de progresso clicável com marcadores
//   visuais entre segmentos, tempo atual/total formatado MM:SS.d, e lista de segmentos
//   clicáveis (cada um com badge de timestamp tabular-nums) que fazem seek no áudio para
//   aquele instante. O segmento ativo durante a reprodução é destacado em tempo real.
//   CenaCard ganha botão "Clock" (timeline) entre Tocar e Download que expande/recolhe o
//   painel — ao abrir, para o player simples para evitar áudio duplicado. Útil para revisar
//   em qual ponto do áudio cada trecho foi falado, sem precisar gerar de novo.
// PR-35 (v3.3.9): Roteirista IA — Controles per-scene de tom da locução (TTS).
//   `useNarracao.gerarNarracao` aceita `voiceSettings` (stability/similarity_boost/style/speed)
//   e inclui esses valores no `texto_hash`, garantindo invalidação correta do cache ao alterar.
//   `gerarLote` aceita `settingsByKey` (override por cenaKey) que respeita skip-if-cached e abort.
//   Edge function `elevenlabs-narracao` já aplicava merge { ...defaultsPorIdioma, ...override },
//   sem alterações no backend. RoteiristaIA persiste overrides em localStorage por roteiroId
//   (`roteirista:voice-settings:<roteiroId>`). CenaCard ganha Popover com 4 sliders (Velocidade
//   0.7-1.2 / Estabilidade / Similaridade / Estilo 0-1), botão "Resetar" para voltar ao padrão
//   do idioma e badge visual quando há override ativo.
// PR-34 (v3.3.8): Roteirista IA — Fila de geração com cancelar e continuar para "Gerar Todas".
//   Hook `useNarracao.gerarLote` aceita `{ signal: AbortSignal }` e verifica abort entre cenas;
//   pula automaticamente itens já cacheados/salvos (skip-if-cached) para retomar sem reprocessar
//   nem perder progresso. Retorna `{ completed, total, cancelled, pendingFromIndex }` indicando
//   próxima cena pendente. RoteiristaIA ganha botão "Cancelar" durante a geração e botões
//   "Continuar (cena N)" / "Descartar fila" quando pausada, além de barra de Progress visual e
//   aviso âmbar com a próxima cena pendente. AbortController gerenciado por ref por sessão de fila.
// PR-33 (v3.3.7): Roteirista IA — Seletor de idioma PT/EN para narração TTS.
//   Edge function `elevenlabs-narracao` aceita campo `language` ("pt" | "en" | "auto"),
//   detecta automaticamente PT vs EN por heurística (acentos, palavras-função) quando "auto",
//   envia `language_code` no payload ElevenLabs e aplica voice_settings tunados por idioma
//   (PT: stability 0.6, similarity 0.8, speed 0.98; EN: stability 0.5, similarity 0.78, speed 1.0)
//   para maximizar fluidez e prosódia natural. Hook `useNarracao` propaga `language` em
//   `gerarNarracao`/`gerarLote` e inclui o idioma no `texto_hash` (regenera ao alternar idioma).
//   RoteiristaIA ganha Select PT/EN/Auto ao lado do seletor de voz, repassado a cada CenaCard
//   e ao "Gerar Todas". Toast informa o idioma usado (auto-detectado ou explícito).
// PR-32 (v3.3.6): Roteirista IA — Persistência de narrações geradas (MP3) no histórico.
//   Nova tabela `roteirista_narracoes` (RLS por user_id, UNIQUE roteiro_id+cena_index+texto_hash)
//   e bucket privado `narracoes-roteirista` (RLS path-based: pasta = user_id). Edge function
//   `elevenlabs-narracao` ganha persistência opcional: ao receber {save, roteiro_id, cena_index},
//   faz upload do MP3 no Storage (signed URL 7d) e upsert na tabela. Hook `useNarracao`
//   ganha `carregarSalvas(roteiroId)` (popula cache via audio_url), `excluirSalva(key)` (remove
//   storage + linha), `savedCount` e suporte a tocar/baixar a partir de URL salva (não só base64).
//   `gerarNarracao` aceita parâmetro `persist` para enviar ao backend; `gerarLote` aceita
//   `roteiroId` final. RoteiristaIA carrega narrações salvas automaticamente ao trocar/abrir
//   roteiro (useEffect em roteiroId), passa `roteiroId` ao CenaCard, exibe badge "Salva" e
//   botão Trash para narrações persistidas. Permite revisar narrações sem regerar.
// PR-31 (v3.3.5): Roteirista IA — Modo de Revisão Colaborativa.
//   Novas tabelas `roteirista_comentarios` (RLS owner-select, author-update/delete) e
//   `roteirista_historico` (RLS owner-only). Novo hook `useRoteiristaRevisao` (load + Realtime
//   por roteiro_id, adicionar/resolver/excluir comentários, registrar evento de histórico).
//   Novo componente `RevisaoPanel` com 2 abas: Comentários (composer com seletor de cena/geral,
//   filtro abertos/resolvidos/todos, ações resolver/reabrir/excluir, badges aberto/resolvido,
//   atalho Cmd+Enter) e Histórico (timeline vertical com diff antes/depois para edições).
//   RoteiristaIA registra eventos automaticamente: roteiro_criado, aprovado, enviado_para_video,
//   cena_editada (com diff de descricao_visual/narracao). CenaCard exibe badge de comentários
//   abertos/total. Botão Aprovar agora chama `aprovarRoteiro` (registra evento + atualiza status).
// PR-30 (v3.3.4): Roteirista IA — Exportação de roteiro em PDF e JSON.
//   Novo utilitário `src/lib/roteirista-export.ts` com `exportarRoteiroPDF` (jsPDF, capa com
//   título, metadados, sinopse, conceito visual, briefing, storyboard cena-a-cena com
//   descrição de câmera/narração/áudio ambiente, CTA, hashtags e paginação) e
//   `exportarRoteiroJSON` (payload versionado com briefing + roteiro estruturado para
//   reuso em outros projetos). Header do roteiro ganha 2 botões (PDF / JSON) ao lado de
//   Aprovar/Enviar p/ Vídeo.
//   Nova tabela `roteirista_briefing_templates` (RLS por user_id) com colunas: nome, tema,
//   objetivo, publico_alvo, tom, duracao_total, numero_cenas, formato, paleta_cores. Novo
//   hook `useBriefingTemplates` (carregar/salvar/excluir). Card Briefing ganha bloco de
//   templates: select para aplicar template (preenche todos os campos do briefing), Dialog
//   "Salvar como template" com preview do briefing atual, e lista compacta dos últimos 5
//   templates com hover-to-delete. Acelera criação repetida de roteiros para campanhas
//   recorrentes.
// PR-28 (v3.3.2): Roteirista IA — Player de Storyboard interativo.
//   Novo componente `StoryboardPlayer` (src/components/marketing/studio/StoryboardPlayer.tsx)
//   com: stage proporcional ao formato (9:16/16:9/1:1), transport controls (play/pause/reset/
//   prev/next), progress bar por cena + tempo acumulado vs total, autoplay sequencial entre
//   cenas, mute toggle para narração, timeline em chips clicáveis (saltar para qualquer cena),
//   tabs Câmera/Narração/Ambiente para alternar visualização do contexto da cena ativa, e
//   indicador visual quando a narração TTS já foi gerada (badge na aba). Sincroniza com
//   `useNarracao.tocar()` durante reprodução. Integrado ao RoteiristaIA acima do storyboard.
// PR-27 (v3.3.1): Roteirista IA — narração TTS via ElevenLabs por cena.
//   Nova edge function `elevenlabs-narracao` (eleven_multilingual_v2, mp3_44100_128) que recebe
//   { texto, voice_id, voice_settings, previous_text, next_text } e devolve audio_base64. Novo
//   hook `useNarracao` com cache em memória por sessão (chave hash voice+texto), play/stop/download
//   MP3, e geração em lote sequencial. RoteiristaIA ganha seletor de voz (8 vozes ElevenLabs PT/EN
//   multilingue), botão "Gerar Todas" com progresso N/total, e por cena: Gerar/Regerar/Tocar/Parar/
//   Baixar. Request stitching ativo (previous_text/next_text passados entre cenas adjacentes para
//   prosódia natural). Fallback de erro tratado (429/credits) com toast.
//   Nova edge function `roteirista-cinematografico` (Gemini 2.5 Pro + tool calling) que converte
//   fontes (PDF/URL/texto) em roteiro estruturado JSON (cenas, planos, movimento de câmera, prompts EN
//   prontos para vídeo IA). Nova tabela `roteiros_cinematograficos` (RLS por user_id, status:
//   rascunho/aprovado/enviado_para_video). Nova aba "Roteirista IA" no Bimaster Studio
//   (StitchDesignStudio: 8→9 abas). Integração com NanoBananaVideoEngine via sessionStorage —
//   roteiro aprovado pré-preenche multi-scene generator. PDF parsing client-side via pdfjs-dist
//   (até 30 páginas), URL extraction via r.jina.ai proxy. Histórico persistente com edição inline
//   por cena (descricao_visual + narracao).
// PR-23 (v3.2.0): SDK v3.3.0 / OpenAPI v4.4.0 — Enriquecimento de dados CP (5 camadas alinhadas).
// FASE 1 (BUG REAL): UpsertSchema/IncluirSchema agora aceitam data_emissao, numero_documento_fiscal,
//   chave_nfe, codigo_tipo_documento, numero_pedido (Upsert tinha .strict() bloqueando — bug real
//   em produção: 5 títulos null). handleIncluir grava data_emissao explicitamente.
//   handleUpdate allowlist expandida (data_emissao, data_entrada, codigo_projeto, etc).
// FASE 2 (JOINs): handleConsultar/handleQuery retornam meta_relacionados (empresa/fornecedor/
//   categoria/departamento/portador/projeto) via PostgREST embedded resources. handleGetPagamentos
//   faz JOIN com contas_bancarias e profiles → conta_corrente + usuario_nome.
// FASE 3 (campos novos): pagamentos ganha codigo_pix + created_by + CHECK enum forma_pagamento.
//   RPC process_payment_atomic +3 params (defaults retro-compatíveis).
// PR-21 (v3.1.13): OpenAPI v4.3.4 — auditoria cosmética final pré-produção (SDK mantém v3.2.4).
// - ContaCorrenteInput completo: 10 campos canônicos (codigo_agencia, numero_conta_corrente,
//   valor_limite, pix_sn enum S/N, bol_sn enum S/N). Campos legados agencia/conta removidos
//   (runtime ignora silenciosamente).
// - EmpresaInput +1 campo: endereco_numero (paridade com SDK TS).
// - ClienteInput -1 campo: telefone1_ddd removido (runtime clientes-api usa Zod .strict() —
//   enviar o campo causava 400). Bug documental — SDK nunca expôs.
// - MetaEnvelope wiring: schema referenciado via allOf nas responses 2xx de CP/CR (escopo
//   declarado). Deixa de ser órfão e habilita validação por geradores OpenAPI.
// - IdempotencyHeaders schema removido (orphan irrecuperável, já coberto por
//   parameters.IdempotencyKey/RequestId + headers.XRequestId).
// PR-20 (v3.1.12): SDK v3.2.4 / OpenAPI v4.3.3 — auditoria de schemas (4ª passada).
// - BUG REAL FIX (análogo events/eventos): ContaCorrentePayload (3 SDKs) usava
//   tipo, banco_codigo, agencia, conta — runtime contas-correntes-api IGNORAVA
//   silenciosamente. Nomes canônicos passam a ser tipo_conta_corrente, codigo_banco,
//   codigo_agencia, numero_conta_corrente + cCodCCInt (chave integração). Aliases
//   legados @deprecated mantidos por 1 versão.
// - ContaCorrenteResponse (TS): campos atualizados (nCodCC, cCodCCInt,
//   codigo_status, descricao_status) refletindo runtime real.
// - Python: ContaCorrentePayload typed @dataclass (era Dict cru sem guia).
//   EmpresaIncluirPayload (PY) +7 campos: responsavel_nome, responsavel_cpf,
//   capital_social, data_abertura, regime_tributario, codigo_ibge_municipio,
//   natureza_juridica.
// - OpenAPI v4.3.3: EmpresaInput +7 campos (paridade TS/PY/spec). ErrorAuth,
//   ErrorValidation, ErrorRateLimit deixam de ser órfãos — schemas inline em
//   components.responses substituídos por $ref. MetaEnvelope referenciado em
//   info.description. Changelog v4.3.3 inline.
// PR-19 (v3.1.11): SDK v3.2.3 / OpenAPI v4.3.2 — auditoria de schemas (3ª passada).
// - BUG REAL FIX: campo `events` → `eventos` (PT) nas interfaces e métodos webhookIncluir
//   dos 3 SDKs. Runtime (webhook-subscriptions-api) só aceita `eventos` — versões
//   anteriores causavam 400 'Campos obrigatórios: ...eventos' em produção.
// - WebhookSubscribePayload ganha campos opcionais: descricao, max_retries, empresa_id
//   e headers_customizados (já aceitos pelo runtime, antes inacessíveis via SDK).
// - OpenAPI generator method-aware: sufixo Listar/Incluir/Alterar/Excluir aplicado
//   apenas em colisões (resolve duplicata cpAnexos = GET+POST que quebrava openapi-generator).
// - 30 operationIds normalizados para camelCase puro: moduleMap expandido + sanitização
//   de underscores residuais + action 'root' substituída por verbo derivado do método.
// - ClienteInput trimmed (6 campos inatingíveis removidos), EmpresaInput expanded
//   (5 campos do SDK adicionados), 8 schemas órfãos removidos.
// - 6 invariantes novos em audit/regression-greps.sh.
// PR-18 (v3.1.10): SDK v3.2.2 / OpenAPI v4.3.1 — resolução final pré-produção.
// - ALIAS BACKEND /cancelar-lote em contas-pagar-api/index.ts (handleCancelar é batch-aware).
//   Resolve 404 em runtime que afetava os 3 SDKs após PR-17 (auditoria externa 2ª passada).
// - OpenAPI v4.3.1 documenta /cancelar-lote (CP), /check e /sync (fornecedores-sync) — eram
//   rotas reais que faltavam na spec (PR-17 prometia 5, entregou 3).
// - Generator OpenAPI: trailing slash removido em raízes de módulo (ep.path === "/" ? api.basePath).
// - 4 invariantes novos em audit/regression-greps.sh.
// PR-17 (v3.1.9): SDK v3.2.1 / OpenAPI v4.3.0 — correção crítica + alinhamento OpenAPI.
// - BUG CRÍTICO TS: cpCancelarLote chamava /contas-pagar-api/cancelar (unitário) — agora /cancelar-lote.
// - PARIDADE Python: cp_anexos_listar migrado para _cp_dispatch (ETag/304/retry como demais cp_*).
// - CR API ganha 3 handlers REAIS (antes 404): /query (cursor+offset), /parcelas, /recebimentos.
//   Paridade total com cpQuery/cpGetParcelas/cpGetPagamentos. CR API_VERSION 1.3.0 → 1.4.0.
// - OpenAPI 4.2.0 → 4.3.0: 5 endpoints documentados (CR /query, /parcelas, /recebimentos +
//   fornecedores-sync /check, /sync — já existiam como rotas, agora aparecem na spec).
// - SDKs (TS/JS/PY) ganham 11 métodos novos: cpUpdate + 10 wrappers da Export API
//   (cpExportStatus/Pending/Paid/Cancelled/Batch/Confirm/History/Summary/Reconciliation/RetryFailed).
//   Cobertura SDK do CP sobe de 19/19 para 30/30 (incluindo Export API 100%).
// - Comentários "USE QUANDO/PREFIRA" expandidos em cpIncluir vs cpUpsert (3 SDKs).
// - Glossário SDK→banco adicionado (codigo_categoria→categoria_codigo, valor_documento→valor_original etc).
// - Quick Start passo 5 documenta fluxo Export API completo.
// - Smoke tests trocam chave probe `/listar` por `/cnae-api/listar` (lookup real, evita falso-positivo grep).
// - 8 invariantes novos em regression-greps.sh (cobertura métodos × 3 linguagens, sem cpListar reaparecendo).
// PR-15 / Onda 4 (v3.1.7): Export API alinhada com `contas_pagar`.
// - handleGetItems(/pending /paid) e handleStatusDetail agora consultam `contas_pagar`
//   (financial_payment_queue era módulo legado vazio → arrays sempre vazios).
// - /cancelled e /reconciliation removidos refs a `conta_pagar_id` (coluna inexistente em
//   erp_export_queue → 500 PGRST204). Decisão arquitetural: payment_queue_id armazena
//   UUID de contas_pagar.id (zero migration; tabela estava vazia).
// - /export-batch agora pré-valida que cada id exista em contas_pagar; IDs ausentes vão
//   para errors[] em vez de virarem 23503 silencioso.
// PR-14 / Onda 3 (v3.1.6): endpoints avançados do Contas a Pagar.
// - Nova tabela cp_anexos (RLS admin-only) — handler de /anexos apontava para
//   payment_attachments inexistente (toda chamada → 500).
// - /parcelas/sync agora usa onConflict=(conta_pagar_id,numero_parcela) com UNIQUE
//   criado em migration; aceita alias `numero` (spec) → `numero_parcela` (coluna);
//   pré-valida FK conta_pagar_id e devolve errosDetalhe[] granular (paridade upsert-lote).
// - GET /parcelas e GET /anexos devolvem [] para títulos sem itens (não 404).
// PR-13 / Onda 2 (v3.1.5): ciclo completo (RPC fix, /update validate refs, /cancelar granular).
// PR-60 (v3.4.24): Tarefas — Backfill de `data_conclusao` reescrito para
//   processamento em lotes (chunked) com `FOR UPDATE SKIP LOCKED`.
//   Substitui o UPDATE em massa anterior, que poderia escalar para lock de
//   tabela em `projeto_tarefas` quando houvesse milhares de órfãs acumuladas
//   e bloquear escritas concorrentes do app de tarefas. Nova assinatura:
//   `backfill_data_conclusao_tarefas(p_source text, p_batch_size int, p_max_batches int)`
//   — todos os parâmetros têm default (`'cron'`, `500`, `200`), preservando
//   100% de compatibilidade com chamadas existentes (cron, RPC manual, UI).
//   Estratégia: loop em PL/pgSQL → CTE seleciona até `batch_size` linhas com
//   `FOR UPDATE SKIP LOCKED` (não disputa com transações em andamento) →
//   UPDATE pelo id → conta o lote → repete até esvaziar a fila ou atingir
//   `max_batches`. Hard cap de 200 lotes × 500 linhas = 100k tarefas/execução,
//   suficiente para uma janela diária; resíduo entra na próxima rodada.
//   Parâmetros são clamped (batch_size: 50–5000, max_batches: 1–2000).
//   Logs em `projeto_tarefas_backfill_log` agora trazem em `details`:
//   `strategy='chunked_skip_locked'`, `batch_size`, `max_batches`,
//   `batches_done`, `orfas_pre`, `orfas_post`, `reached_cap`. Em caso de
//   erro, ainda registra `partial_rows` (linhas já processadas antes da
//   falha). Alertas (PR-57) e checagem semanal (PR-58) seguem operando
//   sem alteração — apenas recebem novos campos no payload `details`.
// PR-24 (Production Hardening, v3.2.1): contas-pagar-api/export-api envoltos em
// secureHandler (WAF L7 + IP blocklist + security headers). RLS pagamentos restrito
// por empresa (semi-join contas_pagar→user_empresas). handleUpsertLote: N+1 → batch
// validate refs + .upsert PostgREST (até 500 itens em ~1s). Idempotência centralizada
// no router (CP_IDEMPOTENT_ROUTES) — checkIdempotency removido dos handlers.
// handleEstornar enfileira webhook conta_pagar.estornado. handleGetRoot delega para
// handleQuery (paginação + meta_relacionados consistentes). meta_relacionados em
// /parcelas e /anexos.
// PR-25 (v3.2.2): NULL-elimination em meta_relacionados — backfill cache na escrita
// (handleIncluir/handleUpsert/handleUpsertLote chamam enrichCachedNames antes do INSERT/UPSERT)
// + fallback ao vivo na leitura (handleQuery/handleConsultar fazem 0-3 queries paralelas para
// preencher empresa_nome/categoria_nome/fornecedor_nome quando o cache denormalized está NULL).
// Backfill histórico aplicado: ~105 linhas (55 empresa_nome + 50 categoria_nome) atualizadas
// via UPDATE…FROM idempotente. Não-quebrante (resposta apenas deixa de retornar NULL onde dado existe).
// PR-62 (v3.4.26): Vincular China — Focus Mode com identidade visual de Projetos.
//   O modal de focus aberto a partir de `ProjetoVincularChina` (rota
//   `/dashboard/projetos/:id/vincular-china`) foi repaginado para herdar o
//   vocabulário visual do módulo de Projetos (`ProjetoSecao`/`ProjetoTarefaRow`):
//   header sticky compacto com chips informativos (Fórmula, Qtd, Peso, Item,
//   OC) no topo, corpo organizado em duas seções colapsáveis com border-left
//   colorida (azul "Documentos", verde "Decisões do Brasil"), linhas de
//   documento em grid alinhado tipo planilha (checkbox/numero/icon/nome/
//   status/ações) e badges com contraste otimizado. Nova prop
//   `variant?: "inline" | "focus"` em `ChinaSubmissaoExpandido` preserva o
//   layout antigo quando renderizado embedado em listas (default "inline") e
//   ativa o novo layout quando renderizado dentro do `Dialog` de focus mode.
//   A barra "X selecionado(s) — Despachar" passa a ser sticky no rodapé do
//   modal (estilo `PresentationActionsBar` do Trade), permanecendo visível
//   durante a rolagem. Empty-state padronizado em `ChinaInboxDecisoes`
//   substitui o texto solto "Nenhuma decisão do Brasil recebida.". Mudança
//   puramente visual: handlers de seleção, despacho, vínculo, abertura da
//   ficha e inbox de decisões permanecem idênticos. Sem migrations, RPCs ou
//   alteração de schema.
// v3.4.28: Corrige flicker visual na Central de Trabalho. Lista de tarefas
//   piscava ao auto-salvar preferências porque (1) `useCentralPreferences`
//   tinha refetchOnMount/staleTime agressivos, e (2) `ListRow`/`ListSection`
//   não estavam memoizados — qualquer re-render do parent recriava o DOM dos
//   inputs internos do Radix Checkbox. Mudanças: `React.memo` em ListRow e
//   ListSection; staleTime 60s + refetchOnMount/Focus desligados; save agora
//   atualiza o cache via setQueryData em vez de invalidar (evita refetch
//   redundante após cada autosave). Sem mudanças funcionais.
export const APP_VERSION = '3.4.37';

// Chave para armazenar versão no localStorage
const VERSION_KEY = 'app_version';
const LAST_CLEAR_KEY = 'app_last_cache_clear';

/**
 * Verifica se há uma nova versão do app e limpa caches se necessário
 */
export function checkAndUpdateVersion(): boolean {
  const storedVersion = localStorage.getItem(VERSION_KEY);
  
  if (storedVersion !== APP_VERSION) {
    logger.log(`[Version] Atualização detectada: ${storedVersion} → ${APP_VERSION}`);
    
    // Limpar TODOS os caches para garantir versão nova
    clearAllCaches();
    
    // Salvar nova versão
    localStorage.setItem(VERSION_KEY, APP_VERSION);
    localStorage.setItem(LAST_CLEAR_KEY, new Date().toISOString());
    
    return true; // Nova versão detectada
  }
  
  return false; // Mesma versão
}

/**
 * Limpa TODOS os caches do navegador agressivamente
 */
export async function clearAllCaches(): Promise<void> {
  // Limpar Cache Storage (Service Worker caches)
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      logger.log(`[Version] Limpando ${cacheNames.length} caches...`);
      
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
        logger.log(`[Version] Cache limpo: ${cacheName}`);
      }
      
      logger.log('[Version] Todos os caches foram limpos');
    } catch (error) {
      logger.error('[Version] Erro ao limpar caches:', error);
    }
  }
  
  // Forçar desregistro de TODOS os Service Workers
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
        logger.log('[Version] Service Worker desregistrado');
      }
    } catch (error) {
      logger.error('[Version] Erro ao desregistrar SW:', error);
    }
  }

  // Limpar sessionStorage (dados de sessão)
  try {
    sessionStorage.clear();
    logger.log('[Version] sessionStorage limpo');
  } catch (e) {
    logger.error('[Version] Erro ao limpar sessionStorage:', e);
  }
}

/**
 * Força reload da página após atualização
 */
export function forceReload(): void {
  window.location.reload();
}

/**
 * Força limpeza e reload completo
 */
export async function forceCleanReload(): Promise<void> {
  await clearAllCaches();
  localStorage.setItem(VERSION_KEY, APP_VERSION);
  // Forçar reload sem cache do navegador
  window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now();
}

/**
 * Força limpeza completa e navega para uma rota específica após login.
 */
export async function forceCleanNavigate(targetPath: string): Promise<void> {
  await clearAllCaches();
  localStorage.setItem(VERSION_KEY, APP_VERSION);

  const url = new URL(targetPath || '/dashboard', window.location.origin);
  url.searchParams.set('app_version', APP_VERSION);
  url.searchParams.set('v', Date.now().toString());
  window.location.replace(url.toString());
}
