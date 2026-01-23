-- =====================================================
-- FASE 1: Sistema Completo de Campanhas de Trade Marketing
-- =====================================================

-- 1.1 Adicionar campos extras à tabela trade_campaigns
ALTER TABLE trade_campaigns 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES prospects(id),
ADD COLUMN IF NOT EXISTS channel VARCHAR(50),
ADD COLUMN IF NOT EXISTS verba_prevista NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS verba_orcada NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sell_in_anterior NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sell_in_atual NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sell_out_anterior NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sell_out_atual NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS crescimento_percentual NUMERIC(8,4),
ADD COLUMN IF NOT EXISTS roi_percentual NUMERIC(8,4),
ADD COLUMN IF NOT EXISTS roi_valor NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS validation_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS validated_by UUID,
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS validation_notes TEXT;

-- 1.2 Criar tabela de produtos da campanha
CREATE TABLE IF NOT EXISTS trade_campaign_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES trade_campaigns(id) ON DELETE CASCADE,
  product_id UUID REFERENCES store_products(id),
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER DEFAULT 0,
  unit_cost NUMERIC(15,2) DEFAULT 0,
  total_invested NUMERIC(15,2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 1.3 Criar tabela de gastos da campanha (Previsto x Orçado x Real)
CREATE TABLE IF NOT EXISTS trade_campaign_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES trade_campaigns(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  valor_previsto NUMERIC(15,2) DEFAULT 0,
  valor_orcado NUMERIC(15,2) DEFAULT 0,
  valor_realizado NUMERIC(15,2) DEFAULT 0,
  comprovante_url TEXT,
  status VARCHAR(50) DEFAULT 'pendente',
  expense_date DATE,
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 1.4 Criar tabela de entradas de Sell In/Out
CREATE TABLE IF NOT EXISTS trade_campaign_sellout_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES trade_campaigns(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id),
  store_name VARCHAR(255),
  entry_type VARCHAR(20) NOT NULL CHECK (entry_type IN ('sell_in', 'sell_out')),
  period VARCHAR(20) NOT NULL CHECK (period IN ('anterior', 'atual')),
  amount NUMERIC(15,2) NOT NULL CHECK (amount >= 0),
  quantity INTEGER,
  entry_date DATE NOT NULL,
  validation_status VARCHAR(50) DEFAULT 'pending',
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 1.5 Criar tabela de log de auditoria
CREATE TABLE IF NOT EXISTS trade_campaign_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES trade_campaigns(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  field_changed VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  user_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- TRIGGERS E FUNÇÕES
-- =====================================================

-- Função para calcular crescimento e ROI automaticamente
CREATE OR REPLACE FUNCTION calculate_campaign_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcular crescimento percentual do Sell Out
  IF COALESCE(NEW.sell_out_anterior, 0) > 0 THEN
    NEW.crescimento_percentual := 
      ((COALESCE(NEW.sell_out_atual, 0) - NEW.sell_out_anterior) / NEW.sell_out_anterior) * 100;
  ELSE
    NEW.crescimento_percentual := NULL;
  END IF;
  
  -- Calcular ROI: (Incremento Sell Out - Custo) / Custo * 100
  IF COALESCE(NEW.actual_cost, 0) > 0 THEN
    NEW.roi_valor := (COALESCE(NEW.sell_out_atual, 0) - COALESCE(NEW.sell_out_anterior, 0)) - NEW.actual_cost;
    NEW.roi_percentual := (NEW.roi_valor / NEW.actual_cost) * 100;
  ELSE
    NEW.roi_valor := 0;
    NEW.roi_percentual := 0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger na tabela trade_campaigns
DROP TRIGGER IF EXISTS trg_calculate_campaign_metrics ON trade_campaigns;
CREATE TRIGGER trg_calculate_campaign_metrics
BEFORE INSERT OR UPDATE ON trade_campaigns
FOR EACH ROW EXECUTE FUNCTION calculate_campaign_metrics();

-- Função para atualizar totais de sell in/out na campanha
CREATE OR REPLACE FUNCTION update_campaign_sellout_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar totais na campanha
  UPDATE trade_campaigns
  SET 
    sell_in_anterior = (
      SELECT COALESCE(SUM(amount), 0) 
      FROM trade_campaign_sellout_entries 
      WHERE campaign_id = COALESCE(NEW.campaign_id, OLD.campaign_id) 
        AND entry_type = 'sell_in' 
        AND period = 'anterior'
        AND validation_status = 'approved'
    ),
    sell_in_atual = (
      SELECT COALESCE(SUM(amount), 0) 
      FROM trade_campaign_sellout_entries 
      WHERE campaign_id = COALESCE(NEW.campaign_id, OLD.campaign_id) 
        AND entry_type = 'sell_in' 
        AND period = 'atual'
        AND validation_status = 'approved'
    ),
    sell_out_anterior = (
      SELECT COALESCE(SUM(amount), 0) 
      FROM trade_campaign_sellout_entries 
      WHERE campaign_id = COALESCE(NEW.campaign_id, OLD.campaign_id) 
        AND entry_type = 'sell_out' 
        AND period = 'anterior'
        AND validation_status = 'approved'
    ),
    sell_out_atual = (
      SELECT COALESCE(SUM(amount), 0) 
      FROM trade_campaign_sellout_entries 
      WHERE campaign_id = COALESCE(NEW.campaign_id, OLD.campaign_id) 
        AND entry_type = 'sell_out' 
        AND period = 'atual'
        AND validation_status = 'approved'
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.campaign_id, OLD.campaign_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_campaign_sellout_totals ON trade_campaign_sellout_entries;
CREATE TRIGGER trg_update_campaign_sellout_totals
AFTER INSERT OR UPDATE OR DELETE ON trade_campaign_sellout_entries
FOR EACH ROW EXECUTE FUNCTION update_campaign_sellout_totals();

-- Função para atualizar gastos realizados na campanha
CREATE OR REPLACE FUNCTION update_campaign_actual_cost()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE trade_campaigns
  SET 
    actual_cost = (
      SELECT COALESCE(SUM(valor_realizado), 0) 
      FROM trade_campaign_expenses 
      WHERE campaign_id = COALESCE(NEW.campaign_id, OLD.campaign_id) 
        AND status = 'aprovado'
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.campaign_id, OLD.campaign_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_campaign_actual_cost ON trade_campaign_expenses;
CREATE TRIGGER trg_update_campaign_actual_cost
AFTER INSERT OR UPDATE OR DELETE ON trade_campaign_expenses
FOR EACH ROW EXECUTE FUNCTION update_campaign_actual_cost();

-- Função para validar limite de gastos
CREATE OR REPLACE FUNCTION check_campaign_expense_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_orcado NUMERIC;
  v_total_gastos NUMERIC;
  v_campaign_status VARCHAR;
BEGIN
  -- Buscar orçado da campanha
  SELECT verba_orcada, status INTO v_orcado, v_campaign_status
  FROM trade_campaigns WHERE id = NEW.campaign_id;
  
  -- Somar gastos realizados (excluindo o registro atual se for update)
  SELECT COALESCE(SUM(valor_realizado), 0) INTO v_total_gastos
  FROM trade_campaign_expenses
  WHERE campaign_id = NEW.campaign_id 
    AND status = 'aprovado'
    AND id != NEW.id;
  
  -- Bloquear se ultrapassar orçamento aprovado
  IF NEW.status = 'aprovado' AND v_orcado > 0 AND (v_total_gastos + NEW.valor_realizado) > v_orcado THEN
    RAISE EXCEPTION 'Gastos ultrapassam o orçamento aprovado. Verba orçada: R$ %, Já utilizado: R$ %, Disponível: R$ %', 
      v_orcado, v_total_gastos, (v_orcado - v_total_gastos);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_campaign_expense_limit ON trade_campaign_expenses;
CREATE TRIGGER trg_check_campaign_expense_limit
BEFORE INSERT OR UPDATE ON trade_campaign_expenses
FOR EACH ROW EXECUTE FUNCTION check_campaign_expense_limit();

-- Função para log de auditoria automático
CREATE OR REPLACE FUNCTION log_campaign_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_user_name TEXT;
BEGIN
  -- Buscar nome do usuário
  SELECT nome INTO v_user_name FROM profiles WHERE id = auth.uid();
  
  IF TG_OP = 'UPDATE' THEN
    -- Log de alterações principais
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO trade_campaign_audit_log (campaign_id, action, field_changed, old_value, new_value, user_id, user_name)
      VALUES (NEW.id, 'status_changed', 'status', OLD.status, NEW.status, auth.uid(), v_user_name);
    END IF;
    
    IF OLD.validation_status IS DISTINCT FROM NEW.validation_status THEN
      INSERT INTO trade_campaign_audit_log (campaign_id, action, field_changed, old_value, new_value, user_id, user_name)
      VALUES (NEW.id, 'validation_changed', 'validation_status', OLD.validation_status, NEW.validation_status, auth.uid(), v_user_name);
    END IF;
    
    IF OLD.verba_orcada IS DISTINCT FROM NEW.verba_orcada THEN
      INSERT INTO trade_campaign_audit_log (campaign_id, action, field_changed, old_value, new_value, user_id, user_name)
      VALUES (NEW.id, 'budget_changed', 'verba_orcada', OLD.verba_orcada::TEXT, NEW.verba_orcada::TEXT, auth.uid(), v_user_name);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_campaign_changes ON trade_campaigns;
CREATE TRIGGER trg_log_campaign_changes
AFTER UPDATE ON trade_campaigns
FOR EACH ROW EXECUTE FUNCTION log_campaign_changes();

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Habilitar RLS nas novas tabelas
ALTER TABLE trade_campaign_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_campaign_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_campaign_sellout_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_campaign_audit_log ENABLE ROW LEVEL SECURITY;

-- Políticas para trade_campaign_products
CREATE POLICY "Users can view campaign products" ON trade_campaign_products
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert campaign products" ON trade_campaign_products
FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own campaign products" ON trade_campaign_products
FOR UPDATE TO authenticated USING (
  created_by = auth.uid() OR 
  public.is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "Admins can delete campaign products" ON trade_campaign_products
FOR DELETE TO authenticated USING (public.is_admin_or_supervisor(auth.uid()));

-- Políticas para trade_campaign_expenses
CREATE POLICY "Users can view campaign expenses" ON trade_campaign_expenses
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert campaign expenses" ON trade_campaign_expenses
FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update campaign expenses" ON trade_campaign_expenses
FOR UPDATE TO authenticated USING (
  created_by = auth.uid() OR 
  public.is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "Admins can delete campaign expenses" ON trade_campaign_expenses
FOR DELETE TO authenticated USING (public.is_admin_or_supervisor(auth.uid()));

-- Políticas para trade_campaign_sellout_entries
CREATE POLICY "Users can view sellout entries" ON trade_campaign_sellout_entries
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert sellout entries" ON trade_campaign_sellout_entries
FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own sellout entries" ON trade_campaign_sellout_entries
FOR UPDATE TO authenticated USING (
  (created_by = auth.uid() AND validation_status = 'pending') OR 
  public.is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "Admins can delete sellout entries" ON trade_campaign_sellout_entries
FOR DELETE TO authenticated USING (public.is_admin_or_supervisor(auth.uid()));

-- Políticas para trade_campaign_audit_log (somente leitura)
CREATE POLICY "Users can view audit log" ON trade_campaign_audit_log
FOR SELECT TO authenticated USING (true);

CREATE POLICY "System can insert audit log" ON trade_campaign_audit_log
FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_campaign_products_campaign ON trade_campaign_products(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_expenses_campaign ON trade_campaign_expenses(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_expenses_status ON trade_campaign_expenses(status);
CREATE INDEX IF NOT EXISTS idx_campaign_sellout_campaign ON trade_campaign_sellout_entries(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sellout_type_period ON trade_campaign_sellout_entries(entry_type, period);
CREATE INDEX IF NOT EXISTS idx_campaign_audit_campaign ON trade_campaign_audit_log(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_customer ON trade_campaigns(customer_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_validation ON trade_campaigns(validation_status);