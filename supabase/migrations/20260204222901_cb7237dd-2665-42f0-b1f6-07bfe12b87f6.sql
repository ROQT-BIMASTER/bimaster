-- ================================================
-- DEPARTMENT BUDGETS TABLE
-- ================================================
CREATE TABLE public.department_budgets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id uuid NOT NULL REFERENCES public.departamentos(id) ON DELETE CASCADE,
  code varchar(20) NOT NULL DEFAULT '',
  name varchar(255) NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  spent_amount numeric NOT NULL DEFAULT 0,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status varchar(50) NOT NULL DEFAULT 'pending',
  approval_status varchar(50) NOT NULL DEFAULT 'pending',
  notes text,
  created_by uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ================================================
-- DEPARTMENT EXPENSES TABLE
-- ================================================
CREATE TABLE public.department_expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id uuid NOT NULL REFERENCES public.departamentos(id) ON DELETE CASCADE,
  budget_id uuid REFERENCES public.department_budgets(id) ON DELETE SET NULL,
  code varchar(20) NOT NULL DEFAULT '',
  category varchar(100) NOT NULL,
  description text,
  valor_previsto numeric NOT NULL DEFAULT 0,
  valor_realizado numeric NOT NULL DEFAULT 0,
  expense_date date,
  status varchar(50) NOT NULL DEFAULT 'pending',
  supplier_name varchar(255),
  supplier_document varchar(50),
  document_type varchar(50),
  document_number varchar(100),
  due_date date,
  portador varchar(255),
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  payment_notes text,
  send_to_financial boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  financial_approved_by uuid REFERENCES auth.users(id),
  financial_approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ================================================
-- CODE GENERATION FUNCTIONS
-- ================================================

-- Function to generate budget code (VDEP-001, VDEP-002, etc.)
CREATE OR REPLACE FUNCTION public.generate_department_budget_code()
RETURNS trigger AS $$
DECLARE
  next_number integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 6) AS integer)), 0) + 1
  INTO next_number
  FROM public.department_budgets
  WHERE code ~ '^VDEP-[0-9]+$';
  
  NEW.code := 'VDEP-' || LPAD(next_number::text, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Function to generate expense code (DDEP-001, DDEP-002, etc.)
CREATE OR REPLACE FUNCTION public.generate_department_expense_code()
RETURNS trigger AS $$
DECLARE
  next_number integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 6) AS integer)), 0) + 1
  INTO next_number
  FROM public.department_expenses
  WHERE code ~ '^DDEP-[0-9]+$';
  
  NEW.code := 'DDEP-' || LPAD(next_number::text, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ================================================
-- TRIGGERS FOR CODE GENERATION
-- ================================================

CREATE TRIGGER generate_budget_code_trigger
  BEFORE INSERT ON public.department_budgets
  FOR EACH ROW
  WHEN (NEW.code = '' OR NEW.code IS NULL)
  EXECUTE FUNCTION public.generate_department_budget_code();

CREATE TRIGGER generate_expense_code_trigger
  BEFORE INSERT ON public.department_expenses
  FOR EACH ROW
  WHEN (NEW.code = '' OR NEW.code IS NULL)
  EXECUTE FUNCTION public.generate_department_expense_code();

-- ================================================
-- UPDATE TIMESTAMP TRIGGERS
-- ================================================

CREATE TRIGGER update_department_budgets_updated_at
  BEFORE UPDATE ON public.department_budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_department_expenses_updated_at
  BEFORE UPDATE ON public.department_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ================================================
-- INDEXES
-- ================================================

CREATE INDEX idx_department_budgets_department ON public.department_budgets(department_id);
CREATE INDEX idx_department_budgets_status ON public.department_budgets(status);
CREATE INDEX idx_department_budgets_approval_status ON public.department_budgets(approval_status);
CREATE INDEX idx_department_expenses_department ON public.department_expenses(department_id);
CREATE INDEX idx_department_expenses_budget ON public.department_expenses(budget_id);
CREATE INDEX idx_department_expenses_status ON public.department_expenses(status);
CREATE INDEX idx_department_expenses_created_by ON public.department_expenses(created_by);
CREATE INDEX idx_department_expenses_send_to_financial ON public.department_expenses(send_to_financial);

-- ================================================
-- ROW LEVEL SECURITY
-- ================================================

ALTER TABLE public.department_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_expenses ENABLE ROW LEVEL SECURITY;

-- Budgets: Allow all authenticated users to view
CREATE POLICY "Allow authenticated users to view department budgets"
  ON public.department_budgets
  FOR SELECT
  TO authenticated
  USING (true);

-- Budgets: Allow authenticated users to insert
CREATE POLICY "Allow authenticated users to create department budgets"
  ON public.department_budgets
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Budgets: Allow updates (for approvals)
CREATE POLICY "Allow authenticated users to update department budgets"
  ON public.department_budgets
  FOR UPDATE
  TO authenticated
  USING (true);

-- Expenses: Users can view their own expenses, managers can view all from their department, financeiro can view all
CREATE POLICY "Allow users to view department expenses"
  ON public.department_expenses
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.departamentos d 
      WHERE d.id = department_id 
      AND d.responsavel_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.profiles p 
      JOIN public.departamentos d ON d.id = p.departamento_id
      WHERE p.id = auth.uid() 
      AND d.nome = 'Financeiro'
    )
  );

-- Expenses: Users can create their own expenses
CREATE POLICY "Allow users to create department expenses"
  ON public.department_expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Expenses: Users can update their own pending expenses, managers can update any from their department
CREATE POLICY "Allow users to update department expenses"
  ON public.department_expenses
  FOR UPDATE
  TO authenticated
  USING (
    (created_by = auth.uid() AND status = 'pending') OR
    EXISTS (
      SELECT 1 FROM public.departamentos d 
      WHERE d.id = department_id 
      AND d.responsavel_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.profiles p 
      JOIN public.departamentos d ON d.id = p.departamento_id
      WHERE p.id = auth.uid() 
      AND d.nome = 'Financeiro'
    )
  );

-- Expenses: Users can delete their own pending expenses
CREATE POLICY "Allow users to delete their own pending expenses"
  ON public.department_expenses
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid() AND status = 'pending');

-- ================================================
-- STORAGE BUCKET
-- ================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('department-expense-docs', 'department-expense-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for department expense documents
CREATE POLICY "Allow authenticated users to view department expense docs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'department-expense-docs');

CREATE POLICY "Allow authenticated users to upload department expense docs"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'department-expense-docs');

CREATE POLICY "Allow authenticated users to update department expense docs"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'department-expense-docs');

CREATE POLICY "Allow authenticated users to delete department expense docs"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'department-expense-docs');