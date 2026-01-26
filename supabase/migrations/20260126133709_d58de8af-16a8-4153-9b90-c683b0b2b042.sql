
-- ================================================================
-- CORREÇÃO DE SEGURANÇA: Vulnerabilidades Críticas v2
-- Data: 2026-01-26
-- ================================================================

-- ================================================================
-- 1. CORRIGIR FUNÇÃO SEM SEARCH_PATH
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_contas_receber_filter_options(p_anos integer[] DEFAULT NULL::integer[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_result jsonb;
  v_data_inicio date;
  v_data_fim date;
BEGIN
  IF p_anos IS NULL OR array_length(p_anos, 1) IS NULL THEN
    v_data_inicio := (EXTRACT(YEAR FROM CURRENT_DATE) - 3)::text || '-01-01';
    v_data_fim := (EXTRACT(YEAR FROM CURRENT_DATE) + 1)::text || '-12-31';
  ELSE
    v_data_inicio := (SELECT MIN(a) FROM unnest(p_anos) AS a)::text || '-01-01';
    v_data_fim := (SELECT MAX(a) FROM unnest(p_anos) AS a)::text || '-12-31';
  END IF;

  WITH base AS (
    SELECT DISTINCT empresa_id, empresa_nome, conta, portador
    FROM contas_receber
    WHERE data_vencimento >= v_data_inicio
      AND data_vencimento <= v_data_fim
  ),
  empresas AS (
    SELECT jsonb_agg(DISTINCT jsonb_build_object('id', empresa_id, 'nome', empresa_nome)) 
    FROM base WHERE empresa_id IS NOT NULL AND empresa_nome IS NOT NULL
  ),
  contas AS (
    SELECT jsonb_agg(DISTINCT conta ORDER BY conta) 
    FROM base WHERE conta IS NOT NULL AND conta != ''
  ),
  portadores AS (
    SELECT jsonb_agg(DISTINCT portador ORDER BY portador) 
    FROM base WHERE portador IS NOT NULL AND portador != ''
  )
  SELECT jsonb_build_object(
    'empresas', COALESCE((SELECT * FROM empresas), '[]'::jsonb),
    'contas', COALESCE((SELECT * FROM contas), '[]'::jsonb),
    'portadores', COALESCE((SELECT * FROM portadores), '[]'::jsonb)
  ) INTO v_result;
  
  RETURN v_result;
END;
$function$;

-- ================================================================
-- 2. CORRIGIR RLS POLICY stores_select_restricted
-- ================================================================

DROP POLICY IF EXISTS "stores_select_restricted" ON public.stores;

-- ================================================================
-- 3. CORRIGIR RLS POLICIES DE trade_campaign_lancamentos
-- Usa created_by (que existe) ao invés de vendedor_id
-- ================================================================

DROP POLICY IF EXISTS "Authenticated users can delete launches" ON public.trade_campaign_lancamentos;
DROP POLICY IF EXISTS "Authenticated users can insert launches" ON public.trade_campaign_lancamentos;
DROP POLICY IF EXISTS "Authenticated users can update launches" ON public.trade_campaign_lancamentos;

CREATE POLICY "trade_campaign_lancamentos_insert_own" ON public.trade_campaign_lancamentos
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (
    created_by = auth.uid() OR
    is_admin_or_supervisor(auth.uid())
  )
);

CREATE POLICY "trade_campaign_lancamentos_update_own" ON public.trade_campaign_lancamentos
FOR UPDATE USING (
  created_by = auth.uid() OR
  validated_by = auth.uid() OR
  is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "trade_campaign_lancamentos_delete_own" ON public.trade_campaign_lancamentos
FOR DELETE USING (
  created_by = auth.uid() OR
  is_admin_or_supervisor(auth.uid())
);

-- ================================================================
-- 4. CORRIGIR RLS POLICIES DE trade_campaign_orders
-- ================================================================

DROP POLICY IF EXISTS "trade_campaign_orders_delete" ON public.trade_campaign_orders;
DROP POLICY IF EXISTS "trade_campaign_orders_insert" ON public.trade_campaign_orders;
DROP POLICY IF EXISTS "trade_campaign_orders_update" ON public.trade_campaign_orders;

CREATE POLICY "trade_campaign_orders_insert_own" ON public.trade_campaign_orders
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (
    created_by = auth.uid() OR
    is_admin_or_supervisor(auth.uid())
  )
);

CREATE POLICY "trade_campaign_orders_update_own" ON public.trade_campaign_orders
FOR UPDATE USING (
  created_by = auth.uid() OR
  is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "trade_campaign_orders_delete_own" ON public.trade_campaign_orders
FOR DELETE USING (
  created_by = auth.uid() OR
  is_admin_or_supervisor(auth.uid())
);

-- ================================================================
-- 5. CORRIGIR RLS POLICY DE fabrica_tarefas_ajuste_preco
-- Não tem created_by, usar aprovada_por
-- ================================================================

DROP POLICY IF EXISTS "Usuários autenticados podem criar tarefas de ajuste" ON public.fabrica_tarefas_ajuste_preco;

CREATE POLICY "fabrica_tarefas_ajuste_insert_authorized" ON public.fabrica_tarefas_ajuste_preco
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin') OR
    usuario_tem_acesso_modulo(auth.uid(), 'fabrica') OR
    usuario_tem_acesso_modulo(auth.uid(), 'precos')
  )
);

-- ================================================================
-- 6. CORRIGIR RLS POLICY DE sensitive_access_log
-- ================================================================

DROP POLICY IF EXISTS "System can insert access log" ON public.sensitive_access_log;

-- ================================================================
-- 7. CRIAR FUNÇÃO SEGURA PARA INSERIR LOGS DE ACESSO
-- ================================================================

CREATE OR REPLACE FUNCTION public.log_sensitive_access(
  p_user_id uuid,
  p_action text,
  p_table_name text,
  p_record_id text DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO sensitive_access_log (user_id, action, table_name, record_id, details, created_at)
  VALUES (p_user_id, p_action, p_table_name, p_record_id, p_details, now());
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- ================================================================
-- 8. ADICIONAR POLÍTICAS DE BLOQUEIO PARA TABELAS DE SERVIÇO
-- ================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'n8n_cache_contas_receber' AND policyname = 'n8n_cache_deny_users') THEN
    EXECUTE 'CREATE POLICY "n8n_cache_deny_users" ON public.n8n_cache_contas_receber FOR ALL TO anon, authenticated USING (false)';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'n8n_sync_control' AND policyname = 'n8n_sync_deny_users') THEN
    EXECUTE 'CREATE POLICY "n8n_sync_deny_users" ON public.n8n_sync_control FOR ALL TO anon, authenticated USING (false)';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sync_logs' AND policyname = 'sync_logs_deny_users') THEN
    EXECUTE 'CREATE POLICY "sync_logs_deny_users" ON public.sync_logs FOR ALL TO anon, authenticated USING (false)';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sync_sessions' AND policyname = 'sync_sessions_deny_users') THEN
    EXECUTE 'CREATE POLICY "sync_sessions_deny_users" ON public.sync_sessions FOR ALL TO anon, authenticated USING (false)';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sync_tracking' AND policyname = 'sync_tracking_deny_users') THEN
    EXECUTE 'CREATE POLICY "sync_tracking_deny_users" ON public.sync_tracking FOR ALL TO anon, authenticated USING (false)';
  END IF;
END$$;

-- ================================================================
-- 9. LIMPAR DUPLICATE SELECT POLICIES EM stores
-- ================================================================

DROP POLICY IF EXISTS "Approved users can view stores" ON public.stores;
DROP POLICY IF EXISTS "Users can view stores based on role" ON public.stores;
DROP POLICY IF EXISTS "Usuários veem lojas RLS" ON public.stores;
DROP POLICY IF EXISTS "Usuários veem lojas conforme hierarquia" ON public.stores;
DROP POLICY IF EXISTS "Vendedores veem lojas vinculadas" ON public.stores;
DROP POLICY IF EXISTS "stores_select_assigned_admin" ON public.stores;

-- Criar uma única política de SELECT consolidada
CREATE POLICY "stores_select_consolidated" ON public.stores
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    is_admin_or_supervisor(auth.uid()) OR
    usuario_tem_acesso_loja(auth.uid(), id) OR
    EXISTS (
      SELECT 1 FROM store_sellers 
      WHERE store_sellers.store_id = stores.id 
      AND store_sellers.vendedor_id = auth.uid()
    )
  )
);

-- ================================================================
-- 10. LIMPAR DUPLICATE INSERT POLICIES EM stores
-- ================================================================

DROP POLICY IF EXISTS "Admins can insert stores" ON public.stores;
DROP POLICY IF EXISTS "Usuarios autenticados podem criar lojas" ON public.stores;
DROP POLICY IF EXISTS "Usuários podem criar lojas com vinculação" ON public.stores;
DROP POLICY IF EXISTS "stores_insert_authenticated" ON public.stores;
DROP POLICY IF EXISTS "stores_insert_restricted" ON public.stores;

CREATE POLICY "stores_insert_consolidated" ON public.stores
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (
    is_admin_or_supervisor(auth.uid()) OR
    created_by = auth.uid()
  )
);

-- ================================================================
-- 11. LIMPAR DUPLICATE UPDATE POLICIES EM stores
-- ================================================================

DROP POLICY IF EXISTS "Admins can update stores" ON public.stores;
DROP POLICY IF EXISTS "Usuários atualizam lojas conforme hierarquia" ON public.stores;
DROP POLICY IF EXISTS "stores_update_owner_admin" ON public.stores;
DROP POLICY IF EXISTS "stores_update_restricted" ON public.stores;

CREATE POLICY "stores_update_consolidated" ON public.stores
FOR UPDATE USING (
  is_admin_or_supervisor(auth.uid()) OR
  usuario_tem_acesso_loja(auth.uid(), id)
) WITH CHECK (
  is_admin_or_supervisor(auth.uid()) OR
  usuario_tem_acesso_loja(auth.uid(), id)
);

-- ================================================================
-- 12. LIMPAR DUPLICATE DELETE POLICIES EM stores
-- ================================================================

DROP POLICY IF EXISTS "Admins can delete stores" ON public.stores;
DROP POLICY IF EXISTS "Admins e supervisores podem deletar lojas" ON public.stores;
DROP POLICY IF EXISTS "stores_delete_restricted" ON public.stores;

CREATE POLICY "stores_delete_consolidated" ON public.stores
FOR DELETE USING (
  is_admin_or_supervisor(auth.uid())
);

-- ================================================================
-- 13. LIMPAR POLICY ALL EM stores (muito permissiva)
-- ================================================================

DROP POLICY IF EXISTS "Apenas admins e supervisores podem gerenciar lojas" ON public.stores;
DROP POLICY IF EXISTS "Usuários gerenciam lojas RLS" ON public.stores;
