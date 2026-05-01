DO $pgnet$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='net'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION net.%I(%s) FROM anon, authenticated, PUBLIC', r.proname, r.args);
  END LOOP;
END$pgnet$;
REVOKE USAGE ON SCHEMA net FROM anon, authenticated, PUBLIC;

DO $rev$
DECLARE
  fn text;
  fn_list text[] := ARRAY[
    '_dispatch_backfill_alert','admin_tarefas_cron_status','atualizar_status_meta_projeto','audit_log_record',
    'calcular_custo_entrada','calcular_iva_item_nf','calcular_status_conta_pagar','calculate_campaign_metrics',
    'check_and_increment_rate_limit_v2','check_campaign_expense_limit','cleanup_expired_idempotency_cache',
    'consistency_check_tarefas_data_conclusao','consistency_check_tarefas_listar','consistency_check_tarefas_resumo',
    'consistency_check_tarefas_run_now','diag_backfill_log_listar','diag_tarefas_sem_data_conclusao',
    'diag_tarefas_sem_data_conclusao_resumo','estoque_faixas_saldo','export_receipt_create',
    'fn_calcular_iva_item_nf_saida','fn_fabrica_produtos_updated_at','fn_normalizar_cliente_individual',
    'fn_normalizar_municipios_clientes','fn_oms_set_updated_at','fn_process_decision_auto_version',
    'fn_set_audit_on_update','fn_set_updated_at','fn_sync_titulo_receber_status',
    'generate_department_budget_code','generate_department_expense_code','generate_event_code',
    'generate_fpq_code','generate_tarefa_codigo','get_analise_departamentos','get_aprovacoes_audit_logs',
    'get_contas_receber_totais_filtrados','handle_updated_at','hash_api_key','honeytoken_touched',
    'notify_budget_approval_change','notify_task_deadlines','projeto_tarefas_set_is_subtask',
    'projetos_atribuir_criador_como_responsavel','projetos_health_kpis','projetos_tarefas_sem_prazo',
    'projetos_tarefas_sem_responsavel','purge_expired_step_up_tokens','refresh_estoque_unificado_cache',
    'security_definer_overrides_touch','security_event_record','set_discovered_profiles_updated_at',
    'set_roteirista_comentarios_updated_at','sync_tarefa_data_conclusao','tg_security_alert_rules_updated_at',
    'touch_user_central_preferences','trg_hash_api_key','update_campaign_actual_cost',
    'update_campaign_sellout_totals','update_event_actual_cost','update_marketing_updated_at',
    'update_phyllo_updated_at','update_vendedor_territorios_updated_at','user_device_register',
    'validate_copilot_acao','validate_copilot_msg_role','waf_get_mode'
  ];
  rec record;
BEGIN
  FOREACH fn IN ARRAY fn_list LOOP
    FOR rec IN
      SELECT pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=fn
    LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon, authenticated, PUBLIC', fn, rec.args);
    END LOOP;
  END LOOP;
END$rev$;