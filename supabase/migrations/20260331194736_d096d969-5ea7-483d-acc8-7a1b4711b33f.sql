
-- ============================================================
-- FASE 3: CREDENTIALS HARDENING
-- ============================================================

-- erp_config: Reforçar RLS para esconder plaintext keys de non-admins
-- A safe view (erp_config_safe) já mascara os dados. 
-- Vamos garantir que apenas admins acessam a tabela real.
DO $$
BEGIN
  -- Drop existing permissive policies on erp_config if any
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'erp_config' AND policyname = 'Authenticated users can view erp_config') THEN
    DROP POLICY "Authenticated users can view erp_config" ON erp_config;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'erp_config' AND policyname = 'erp_config_select') THEN
    DROP POLICY "erp_config_select" ON erp_config;
  END IF;
END $$;

-- Only admins can read erp_config (plaintext keys)
CREATE POLICY "erp_config_select_admin_only" ON erp_config FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- configuracoes_cobranca: same pattern
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'configuracoes_cobranca' AND policyname = 'Authenticated users can view configuracoes_cobranca') THEN
    DROP POLICY "Authenticated users can view configuracoes_cobranca" ON configuracoes_cobranca;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'configuracoes_cobranca' AND policyname = 'configuracoes_cobranca_select') THEN
    DROP POLICY "configuracoes_cobranca_select" ON configuracoes_cobranca;
  END IF;
END $$;

CREATE POLICY "cobranca_config_select_admin_only" ON configuracoes_cobranca FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
