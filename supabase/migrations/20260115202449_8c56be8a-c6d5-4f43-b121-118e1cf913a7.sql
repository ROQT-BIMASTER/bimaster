
-- PARTE 3: Remover políticas permissivas restantes (N-Z)

-- notifications
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- photo_analysis_queue
DROP POLICY IF EXISTS "System can update queue" ON public.photo_analysis_queue;

-- prospects
DROP POLICY IF EXISTS "prospects_insert_restricted" ON public.prospects;

-- qa_issues
DROP POLICY IF EXISTS "Authenticated users can insert qa_issues" ON public.qa_issues;
DROP POLICY IF EXISTS "Authenticated users can update qa_issues" ON public.qa_issues;

-- qa_test_results
DROP POLICY IF EXISTS "Authenticated users can insert qa_test_results" ON public.qa_test_results;

-- report_history
DROP POLICY IF EXISTS "System can insert report history" ON public.report_history;

-- social_media_metrics_history
DROP POLICY IF EXISTS "Authenticated users can insert social media metrics" ON public.social_media_metrics_history;
DROP POLICY IF EXISTS "System can insert metrics history" ON public.social_media_metrics_history;

-- sync_tracking
DROP POLICY IF EXISTS "Service role pode atualizar sync_tracking" ON public.sync_tracking;
DROP POLICY IF EXISTS "Service role pode inserir sync_tracking" ON public.sync_tracking;

-- trade_chart_of_accounts
DROP POLICY IF EXISTS "Usuarios autenticados podem atualizar contas contabeis" ON public.trade_chart_of_accounts;
DROP POLICY IF EXISTS "Usuarios autenticados podem criar contas contabeis" ON public.trade_chart_of_accounts;

-- user_points_history
DROP POLICY IF EXISTS "Sistema insere pontos automaticamente" ON public.user_points_history;

-- whatsapp_conversations
DROP POLICY IF EXISTS "Sistema pode atualizar conversas" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Sistema pode inserir conversas" ON public.whatsapp_conversations;

-- whatsapp_messages
DROP POLICY IF EXISTS "Sistema pode inserir mensagens" ON public.whatsapp_messages;
