-- Phase 2: drop dangerous function and revoke EXECUTE on functions
-- with zero references in src/ and supabase/functions/

-- 2.1 DROP exec_sql (RCE risk)
DROP FUNCTION IF EXISTS public.exec_sql(text);

-- 2.2 Revoke EXECUTE from anon/authenticated on safe functions
DO $$
DECLARE
  fn text;
  rec record;
BEGIN
  FOR fn IN SELECT unnest(ARRAY[
    'aplicar_mapeamento_plano_contas','archive_old_audit_logs','atualizar_perfil_credito_cliente',
    'bulk_upsert_contas_receber','bulk_upsert_contas_receber_v2','buscar_dados_cliente_cobranca',
    'buscar_regra_fiscal_item','buscar_regra_fiscal_ncm','calcular_custo_medio_fifo',
    'calcular_custo_medio_ponderado','calcular_custo_mod_op','calcular_data_util',
    'calcular_score_cliente','calcular_status_financeiro','calculate_user_level',
    'calculate_visit_points','campo_visivel_para_departamento','can_access_ads_account',
    'can_access_cliente','can_access_credit_data','can_access_financeiro_strict',
    'can_access_trade_audit','can_access_trade_budget','can_approve_doc',
    'check_endpoint_rate_limit','check_throttle','cleanup_audit_logs_batch',
    'cleanup_audit_logs_daily','cleanup_expired_rate_limiter_slots','cleanup_old_login_attempts',
    'cleanup_old_rate_limits','cleanup_rate_limit','cleanup_session_invalidation_queue',
    'complete_sync','componente_editavel','componente_permitido','enfileirar_cobrancas_automaticas',
    'expire_old_convites','fn_atribuir_vendedor_territorio','fn_criar_titulo_receber',
    'fn_enfileirar_erp','fn_pesquisar_titulos','fn_registrar_recebimento','fn_resumo_financeiro',
    'gerar_creditos_tributarios','gerar_tarefas_etapa','get_atividades_kpis',
    'get_contas_receber_filtros','get_conversion_funnel','get_custo_hora','get_financial_kpis',
    'get_last_sync_timestamp','get_reativacao_kpis','get_sales_performance','get_subordinates',
    'get_trade_dashboard_summary','get_trade_performance','get_user_empresa_ids',
    'get_user_module_permissions','get_user_screen_permissions','has_dev_papel',
    'has_strict_finance_access','icms_gera_credito','icms_tipo_credito','inbox_emit',
    'inbox_resolver_item','is_ip_blacklisted','is_user_in_projetos_department','log_audit',
    'log_sensitive_access','notificar_espelhos_pendentes_sem_doc','pis_cofins_gera_credito',
    'pis_cofins_tipo_credito','register_action_points','register_user_points',
    'resolver_projeto_da_instancia','sincronizar_permissoes_usuario','start_sync',
    'start_sync_session','suggest_classification_from_history','update_sync_progress',
    'update_user_ranking','user_accepts_notification','user_can_access_price_table',
    'user_can_approve_price_table','user_has_store_access','user_tem_acesso_cnpj',
    'usuario_tem_acesso_tela','validar_creditos_nota_fiscal','validar_docs_obrigatorios_espelho'
  ])
  LOOP
    FOR rec IN
      SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
    LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated, anon, public', rec.sig);
    END LOOP;
  END LOOP;
END $$;
