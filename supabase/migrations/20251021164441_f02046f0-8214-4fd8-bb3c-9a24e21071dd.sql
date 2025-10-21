-- =====================================================
-- MÓDULO FINANCEIRO TRADE MARKETING - MELHORIAS
-- Adiciona: Campanhas, Reservas, Fluxo de Aprovação
-- =====================================================

-- 1. NÍVEIS DE APROVAÇÃO (Configuração de hierarquia)
CREATE TABLE IF NOT EXISTS public.trade_approval_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_number INTEGER NOT NULL UNIQUE,
  role_name VARCHAR(100) NOT NULL,
  max_approval_amount NUMERIC(15,2) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- 2. CAMPANHAS/AÇÕES (Agrupa investimentos)
CREATE TABLE IF NOT EXISTS public.trade_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  campaign_type VARCHAR(50) NOT NULL, -- 'sell_in', 'sell_out', 'institucional', 'cooperada', 'mdf', etc
  budget_id UUID REFERENCES public.trade_budgets(id),
  estimated_cost NUMERIC(15,2) NOT NULL,
  actual_cost NUMERIC(15,2) DEFAULT 0,
  target_revenue NUMERIC(15,2),
  actual_revenue NUMERIC(15,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'pending_approval', 'approved', 'in_progress', 'completed', 'cancelled'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  region VARCHAR(100),
  target_stores UUID[], -- Array de IDs de lojas
  responsible_user_id UUID NOT NULL,
  created_by UUID,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  CONSTRAINT valid_campaign_dates CHECK (end_date >= start_date)
);

-- 3. RESERVAS DE VERBA (Bloqueia valores do orçamento)
CREATE TABLE IF NOT EXISTS public.trade_budget_reserves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES public.trade_budgets(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.trade_campaigns(id) ON DELETE CASCADE,
  reserved_amount NUMERIC(15,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'released', 'consumed'
  reserved_at TIMESTAMP DEFAULT now(),
  released_at TIMESTAMP,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP DEFAULT now()
);

-- 4. APROVAÇÕES (Histórico completo de aprovações)
CREATE TABLE IF NOT EXISTS public.trade_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL, -- 'campaign', 'investment', 'financial_entry'
  entity_id UUID NOT NULL,
  approval_level INTEGER NOT NULL,
  approver_user_id UUID NOT NULL,
  status VARCHAR(50) NOT NULL, -- 'pending', 'approved', 'rejected'
  amount NUMERIC(15,2) NOT NULL,
  comments TEXT,
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

-- 5. Adicionar campos nas tabelas existentes
ALTER TABLE public.trade_budgets 
ADD COLUMN IF NOT EXISTS reserved_amount NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS available_amount NUMERIC(15,2) GENERATED ALWAYS AS (
  total_amount - COALESCE(spent_amount, 0) - COALESCE(reserved_amount, 0)
) STORED;

ALTER TABLE public.trade_investments
ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.trade_campaigns(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS approved_by UUID,
ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

ALTER TABLE public.trade_financial_entries
ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.trade_campaigns(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS approved_by UUID,
ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

-- 6. ÍNDICES para performance
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.trade_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_budget ON public.trade_campaigns(budget_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON public.trade_campaigns(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_reserves_budget ON public.trade_budget_reserves(budget_id);
CREATE INDEX IF NOT EXISTS idx_reserves_campaign ON public.trade_budget_reserves(campaign_id);
CREATE INDEX IF NOT EXISTS idx_approvals_entity ON public.trade_approvals(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_approvals_approver ON public.trade_approvals(approver_user_id);

-- 7. TRIGGERS para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_trade_campaigns_updated_at ON public.trade_campaigns;
CREATE TRIGGER update_trade_campaigns_updated_at
  BEFORE UPDATE ON public.trade_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trade_approval_levels_updated_at ON public.trade_approval_levels;
CREATE TRIGGER update_trade_approval_levels_updated_at
  BEFORE UPDATE ON public.trade_approval_levels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. FUNÇÃO para validar saldo antes de reservar
CREATE OR REPLACE FUNCTION validate_budget_reserve()
RETURNS TRIGGER AS $$
DECLARE
  budget_available NUMERIC(15,2);
BEGIN
  SELECT (total_amount - COALESCE(spent_amount, 0) - COALESCE(reserved_amount, 0))
  INTO budget_available
  FROM trade_budgets
  WHERE id = NEW.budget_id;
  
  IF budget_available < NEW.reserved_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente na verba. Disponível: R$ %', budget_available;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_reserve_before_insert ON public.trade_budget_reserves;
CREATE TRIGGER validate_reserve_before_insert
  BEFORE INSERT ON public.trade_budget_reserves
  FOR EACH ROW EXECUTE FUNCTION validate_budget_reserve();

-- 9. FUNÇÃO para atualizar reserved_amount quando reserva é criada/liberada
CREATE OR REPLACE FUNCTION update_budget_reserved_amount()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    UPDATE trade_budgets
    SET reserved_amount = COALESCE(reserved_amount, 0) + NEW.reserved_amount
    WHERE id = NEW.budget_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'active' AND NEW.status IN ('released', 'consumed') THEN
    UPDATE trade_budgets
    SET reserved_amount = COALESCE(reserved_amount, 0) - OLD.reserved_amount
    WHERE id = OLD.budget_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_budget_reserve_amount ON public.trade_budget_reserves;
CREATE TRIGGER update_budget_reserve_amount
  AFTER INSERT OR UPDATE ON public.trade_budget_reserves
  FOR EACH ROW EXECUTE FUNCTION update_budget_reserved_amount();

-- 10. RLS POLICIES

-- trade_approval_levels
ALTER TABLE public.trade_approval_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar níveis de aprovação"
  ON public.trade_approval_levels FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários autenticados podem ver níveis de aprovação"
  ON public.trade_approval_levels FOR SELECT
  USING (true);

-- trade_campaigns
ALTER TABLE public.trade_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e supervisores podem gerenciar campanhas"
  ON public.trade_campaigns FOR ALL
  USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Usuários podem ver campanhas que criaram"
  ON public.trade_campaigns FOR SELECT
  USING (responsible_user_id = auth.uid() OR created_by = auth.uid() OR is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Usuários podem criar campanhas"
  ON public.trade_campaigns FOR INSERT
  WITH CHECK (responsible_user_id = auth.uid() OR created_by = auth.uid());

-- trade_budget_reserves
ALTER TABLE public.trade_budget_reserves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e supervisores podem gerenciar reservas"
  ON public.trade_budget_reserves FOR ALL
  USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Usuários podem ver reservas relacionadas às suas campanhas"
  ON public.trade_budget_reserves FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trade_campaigns
      WHERE id = trade_budget_reserves.campaign_id
      AND (responsible_user_id = auth.uid() OR created_by = auth.uid())
    ) OR is_admin_or_supervisor(auth.uid())
  );

-- trade_approvals
ALTER TABLE public.trade_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar todas aprovações"
  ON public.trade_approvals FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários podem ver aprovações relacionadas"
  ON public.trade_approvals FOR SELECT
  USING (
    approver_user_id = auth.uid() 
    OR is_admin_or_supervisor(auth.uid())
  );

CREATE POLICY "Aprovadores podem criar aprovações"
  ON public.trade_approvals FOR INSERT
  WITH CHECK (approver_user_id = auth.uid());

CREATE POLICY "Aprovadores podem atualizar suas aprovações"
  ON public.trade_approvals FOR UPDATE
  USING (approver_user_id = auth.uid() OR is_admin_or_supervisor(auth.uid()));

-- 11. DADOS INICIAIS - Níveis de Aprovação padrão
INSERT INTO public.trade_approval_levels (level_number, role_name, max_approval_amount, description) VALUES
  (1, 'Promotor/Supervisor', 5000, 'Pode aprovar ações até R$ 5.000'),
  (2, 'Coordenador/Gerente Trade', 20000, 'Pode aprovar ações até R$ 20.000'),
  (3, 'Diretor Comercial/Marketing', 100000, 'Pode aprovar ações até R$ 100.000'),
  (4, 'Financeiro/Controladoria', 999999999, 'Aprovação final sem limite')
ON CONFLICT (level_number) DO NOTHING;