-- ============================================================================
-- MIGRAÇÃO CONSOLIDADA — Lotes 1, 2 e 3 (Referência / Documentação)
-- Data: 2026-03-19/20
-- Status: Já aplicada via Lovable Cloud migration tool
-- Regra: Apenas IF NOT EXISTS / ON CONFLICT DO NOTHING / CREATE OR REPLACE
-- ============================================================================

-- ============================================================================
-- LOTE 1 — Correções 1-3
-- ============================================================================

-- FIX1: erp-webhook-inbound — validação de API key separada de empresa_id
-- (Alteração em Edge Function, sem DDL)

-- FIX2: Índices de performance
CREATE INDEX IF NOT EXISTS idx_erp_sync_log_empresa_criado
  ON erp_sync_log(empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_erp_sync_log_idempotencia
  ON erp_sync_log(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contas_pagar_empresa_status
  ON contas_pagar(empresa_id, status);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_pluggy
  ON contas_pagar(pluggy_transaction_id)
  WHERE pluggy_transaction_id IS NOT NULL;

-- FIX3: Seed ui_permissions (fail-open seguro)
INSERT INTO ui_permissions (role, departamento_id, tela_codigo, componente_codigo, visivel, editavel)
SELECT 'admin', NULL, codigo, '*', true, true
FROM telas_sistema WHERE ativo = true
ON CONFLICT DO NOTHING;

INSERT INTO ui_permissions (role, departamento_id, tela_codigo, componente_codigo, visivel, editavel)
SELECT 'supervisor', NULL, codigo, '*', true, true
FROM telas_sistema WHERE ativo = true AND codigo IN (
  'dashboard', 'prospects', 'atividades', 'kanban', 'mapa', 'municipios', 'ranking',
  'comercial_dashboard', 'comercial_lancamentos',
  'financeiro_dashboard', 'financeiro_contas_pagar', 'financeiro_contas_receber',
  'financeiro_fluxo_caixa', 'financeiro_dre', 'financeiro_plano_contas',
  'trade_stores', 'trade_visits', 'trade_photos',
  'TRADE_DASHBOARD', 'TRADE_LOJAS', 'TRADE_VISITAS', 'TRADE_FOTOS', 'TRADE_PERFORMANCE',
  'relatorios', 'RELATORIOS_DASHBOARD',
  'PROSPECTS_DASHBOARD', 'PROSPECTS_LISTA', 'PROSPECTS_KANBAN', 'PROSPECTS_MAPA', 'PROSPECTS_ATIVIDADES'
)
ON CONFLICT DO NOTHING;

INSERT INTO ui_permissions (role, departamento_id, tela_codigo, componente_codigo, visivel, editavel)
SELECT 'supervisor', NULL, codigo, '*', true, false
FROM telas_sistema WHERE ativo = true AND codigo IN (
  'configuracoes', 'config_geral', 'auditoria',
  'financeiro_aprovacoes_depts', 'financeiro_classificar', 'financeiro_verbas'
)
ON CONFLICT DO NOTHING;

INSERT INTO ui_permissions (role, departamento_id, tela_codigo, componente_codigo, visivel, editavel)
SELECT 'gerente', NULL, codigo, '*', true, true
FROM telas_sistema WHERE ativo = true AND codigo IN (
  'dashboard', 'prospects', 'atividades', 'kanban', 'mapa', 'municipios', 'ranking',
  'comercial_dashboard', 'comercial_lancamentos',
  'financeiro_dashboard', 'financeiro_contas_pagar', 'financeiro_contas_receber',
  'financeiro_fluxo_caixa', 'financeiro_dre',
  'relatorios', 'RELATORIOS_DASHBOARD',
  'PROSPECTS_DASHBOARD', 'PROSPECTS_LISTA', 'PROSPECTS_KANBAN', 'PROSPECTS_MAPA', 'PROSPECTS_ATIVIDADES'
)
ON CONFLICT DO NOTHING;

INSERT INTO ui_permissions (role, departamento_id, tela_codigo, componente_codigo, visivel, editavel)
SELECT 'vendedor', NULL, codigo, '*', true, true
FROM telas_sistema WHERE ativo = true AND codigo IN (
  'dashboard', 'prospects', 'atividades', 'kanban', 'mapa', 'municipios',
  'comercial_dashboard', 'comercial_lancamentos',
  'PROSPECTS_DASHBOARD', 'PROSPECTS_LISTA', 'PROSPECTS_KANBAN', 'PROSPECTS_MAPA', 'PROSPECTS_ATIVIDADES'
)
ON CONFLICT DO NOTHING;

INSERT INTO ui_permissions (role, departamento_id, tela_codigo, componente_codigo, visivel, editavel)
SELECT 'vendedor', NULL, codigo, '*', true, false
FROM telas_sistema WHERE ativo = true AND codigo IN (
  'ranking', 'relatorios', 'RELATORIOS_DASHBOARD',
  'TRADE_DASHBOARD', 'TRADE_LOJAS', 'TRADE_VISITAS', 'TRADE_FOTOS'
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- LOTE 2 — Correções 4-5
-- ============================================================================

-- FIX4: Idempotência reforçada no erp-webhook-inbound
-- (Alteração em Edge Function, sem DDL)

-- FIX5: Função server-side para validação multi-tenant
CREATE OR REPLACE FUNCTION public.get_empresa_ids_do_usuario()
RETURNS integer[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    ARRAY(SELECT empresa_id FROM user_empresas WHERE user_id = auth.uid()),
    ARRAY[]::integer[]
  );
$$;

-- FIX5: RLS restritiva no erp_sync_log
-- Substituiu "Authenticated users can read erp_sync_log" (USING true)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'erp_sync_log'
    AND policyname = 'erp_sync_log_select_empresa'
  ) THEN
    CREATE POLICY "erp_sync_log_select_empresa"
      ON erp_sync_log FOR SELECT TO authenticated
      USING (
        empresa_id = ANY(get_empresa_ids_do_usuario())
        OR has_role(auth.uid(), 'admin')
      );
  END IF;
END $$;

-- ============================================================================
-- LOTE 3 — Correções 6-8
-- ============================================================================

-- FIX6: Rate limiting table
CREATE TABLE IF NOT EXISTS api_rate_limit (
  chave TEXT NOT NULL,
  janela TIMESTAMPTZ NOT NULL DEFAULT date_trunc('minute', now()),
  contador INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (chave, janela)
);

ALTER TABLE api_rate_limit ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'api_rate_limit'
    AND policyname = 'service_role_full_access'
  ) THEN
    CREATE POLICY "service_role_full_access" ON api_rate_limit
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rate_limit_chave_janela ON api_rate_limit(chave, janela);

CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(p_chave TEXT, p_limite INTEGER)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contador INTEGER;
BEGIN
  INSERT INTO api_rate_limit (chave, janela, contador)
  VALUES (p_chave, date_trunc('minute', now()), 1)
  ON CONFLICT (chave, janela) DO UPDATE SET contador = api_rate_limit.contador + 1
  RETURNING contador INTO v_contador;

  RETURN v_contador <= p_limite;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_rate_limit()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM api_rate_limit WHERE janela < now() - interval '1 hour';
$$;

-- FIX7: API Key rotation columns
ALTER TABLE erp_config ADD COLUMN IF NOT EXISTS api_key_anterior TEXT;
ALTER TABLE erp_config ADD COLUMN IF NOT EXISTS api_key_expira_em TIMESTAMPTZ;
ALTER TABLE erp_config ADD COLUMN IF NOT EXISTS api_key_anterior_expira_em TIMESTAMPTZ;
