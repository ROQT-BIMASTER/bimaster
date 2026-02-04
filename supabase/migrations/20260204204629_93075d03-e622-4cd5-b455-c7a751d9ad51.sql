-- =============================================
-- CORPORATE EVENTS MODULE - Complete Database Schema
-- =============================================

-- 1. Create corporate_events table
CREATE TABLE public.corporate_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  event_type VARCHAR(50) DEFAULT 'interno',
  event_date DATE,
  end_date DATE,
  location VARCHAR(255),
  budget_id UUID REFERENCES public.trade_budgets(id) ON DELETE SET NULL,
  budget_amount NUMERIC(15,2) DEFAULT 0,
  actual_cost NUMERIC(15,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'draft',
  confidential BOOLEAN DEFAULT false,
  responsible_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMENT ON TABLE public.corporate_events IS 'Eventos corporativos com controle de orçamento e confidencialidade';

-- 2. Create corporate_event_expenses table
CREATE TABLE public.corporate_event_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.corporate_events(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL DEFAULT 'outros',
  description TEXT,
  valor_previsto NUMERIC(15,2) DEFAULT 0,
  valor_realizado NUMERIC(15,2) DEFAULT 0,
  expense_date DATE,
  status VARCHAR(50) DEFAULT 'pending',
  comprovante_url TEXT,
  evidencias JSONB DEFAULT '[]'::jsonb,
  send_to_financial BOOLEAN DEFAULT false,
  supplier_name VARCHAR(255),
  supplier_document VARCHAR(20),
  document_type VARCHAR(50),
  document_number VARCHAR(100),
  due_date DATE,
  portador VARCHAR(100),
  payment_notes TEXT,
  financial_approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  financial_approved_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  contas_pagar_id UUID,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Create corporate_event_access table
CREATE TABLE public.corporate_event_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  can_create_events BOOLEAN DEFAULT false,
  can_approve_events BOOLEAN DEFAULT false,
  can_view_confidential BOOLEAN DEFAULT false,
  can_manage_expenses BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- 4. Create indexes
CREATE INDEX idx_corporate_events_status ON public.corporate_events(status);
CREATE INDEX idx_corporate_events_budget_id ON public.corporate_events(budget_id);
CREATE INDEX idx_corporate_events_responsible ON public.corporate_events(responsible_user_id);
CREATE INDEX idx_corporate_events_confidential ON public.corporate_events(confidential);
CREATE INDEX idx_corporate_events_event_date ON public.corporate_events(event_date);

CREATE INDEX idx_event_expenses_event_id ON public.corporate_event_expenses(event_id);
CREATE INDEX idx_event_expenses_status ON public.corporate_event_expenses(status);
CREATE INDEX idx_event_expenses_send_financial ON public.corporate_event_expenses(send_to_financial) WHERE send_to_financial = true;
CREATE INDEX idx_event_expenses_due_date ON public.corporate_event_expenses(due_date);

CREATE INDEX idx_event_access_user ON public.corporate_event_access(user_id);

-- 5. Create triggers for updated_at
CREATE TRIGGER update_corporate_events_updated_at
  BEFORE UPDATE ON public.corporate_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_corporate_event_expenses_updated_at
  BEFORE UPDATE ON public.corporate_event_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Create function for event code generation
CREATE OR REPLACE FUNCTION public.generate_event_code()
RETURNS TRIGGER AS $$
DECLARE
  year_part TEXT;
  next_seq INT;
BEGIN
  year_part := to_char(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(code FROM 'EV-' || year_part || '-(\d+)') AS INT)
  ), 0) + 1
  INTO next_seq
  FROM public.corporate_events
  WHERE code LIKE 'EV-' || year_part || '-%';
  
  NEW.code := 'EV-' || year_part || '-' || LPAD(next_seq::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER generate_event_code_trigger
  BEFORE INSERT ON public.corporate_events
  FOR EACH ROW
  WHEN (NEW.code IS NULL OR NEW.code = '')
  EXECUTE FUNCTION public.generate_event_code();

-- 7. Helper function for admin/supervisor check
CREATE OR REPLACE FUNCTION public.is_admin_or_supervisor(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('admin', 'supervisor')
  )
$$;

-- 8. Function to check event access
CREATE OR REPLACE FUNCTION public.has_event_access(_user_id UUID, _permission TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.corporate_event_access
    WHERE user_id = _user_id
    AND (
      _permission IS NULL
      OR (_permission = 'create' AND can_create_events = true)
      OR (_permission = 'approve' AND can_approve_events = true)
      OR (_permission = 'confidential' AND can_view_confidential = true)
      OR (_permission = 'expenses' AND can_manage_expenses = true)
    )
  )
$$;

-- 9. Function to check if user can view event
CREATE OR REPLACE FUNCTION public.can_view_event(_user_id UUID, _event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.corporate_events e
    LEFT JOIN public.corporate_event_access a ON a.user_id = _user_id
    WHERE e.id = _event_id
    AND (
      public.is_admin_or_supervisor(_user_id)
      OR e.created_by = _user_id
      OR e.responsible_user_id = _user_id
      OR (a.id IS NOT NULL AND (e.confidential = false OR a.can_view_confidential = true))
    )
  )
$$;

-- 10. Function to update event actual_cost
CREATE OR REPLACE FUNCTION public.update_event_actual_cost()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.corporate_events
  SET actual_cost = (
    SELECT COALESCE(SUM(valor_realizado), 0)
    FROM public.corporate_event_expenses
    WHERE event_id = COALESCE(NEW.event_id, OLD.event_id)
    AND status IN ('approved', 'pending_financial', 'paid')
  )
  WHERE id = COALESCE(NEW.event_id, OLD.event_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_event_actual_cost_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.corporate_event_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_event_actual_cost();

-- 11. Enable RLS
ALTER TABLE public.corporate_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_event_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_event_access ENABLE ROW LEVEL SECURITY;

-- 12. RLS Policies for corporate_events
CREATE POLICY "Users can view authorized events"
ON public.corporate_events FOR SELECT TO authenticated
USING (
  public.is_admin_or_supervisor(auth.uid())
  OR created_by = auth.uid()
  OR responsible_user_id = auth.uid()
  OR (
    EXISTS (SELECT 1 FROM corporate_event_access a WHERE a.user_id = auth.uid())
    AND (confidential = false OR EXISTS (SELECT 1 FROM corporate_event_access a WHERE a.user_id = auth.uid() AND a.can_view_confidential = true))
  )
);

CREATE POLICY "Users with permission can create events"
ON public.corporate_events FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (public.is_admin_or_supervisor(auth.uid()) OR public.has_event_access(auth.uid(), 'create'))
);

CREATE POLICY "Authorized users can update events"
ON public.corporate_events FOR UPDATE TO authenticated
USING (
  public.is_admin_or_supervisor(auth.uid())
  OR created_by = auth.uid()
  OR responsible_user_id = auth.uid()
  OR public.has_event_access(auth.uid(), 'approve')
);

CREATE POLICY "Only admins can delete events"
ON public.corporate_events FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 13. RLS Policies for corporate_event_expenses
CREATE POLICY "Users can view event expenses"
ON public.corporate_event_expenses FOR SELECT TO authenticated
USING (
  public.can_view_event(auth.uid(), event_id)
  OR (status = 'pending_financial' AND EXISTS (
    SELECT 1 FROM profiles p LEFT JOIN departamentos d ON d.id = p.departamento_id
    WHERE p.id = auth.uid() AND d.nome IN ('Financeiro', 'Tesouraria', 'Contabilidade')
  ))
);

CREATE POLICY "Users can create event expenses"
ON public.corporate_event_expenses FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND public.can_view_event(auth.uid(), event_id));

CREATE POLICY "Authorized users can update event expenses"
ON public.corporate_event_expenses FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_admin_or_supervisor(auth.uid())
  OR public.has_event_access(auth.uid(), 'expenses')
  OR (status = 'pending_financial' AND EXISTS (
    SELECT 1 FROM profiles p LEFT JOIN departamentos d ON d.id = p.departamento_id
    WHERE p.id = auth.uid() AND d.nome IN ('Financeiro', 'Tesouraria', 'Contabilidade')
  ))
);

CREATE POLICY "Only admins can delete event expenses"
ON public.corporate_event_expenses FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 14. RLS Policies for corporate_event_access
CREATE POLICY "Users can view access permissions"
ON public.corporate_event_access FOR SELECT TO authenticated
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Only admins can insert access"
ON public.corporate_event_access FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Only admins can update access"
ON public.corporate_event_access FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Only admins can delete access"
ON public.corporate_event_access FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));