
-- Tabela de exceções de calendário de pagamento por fornecedor
CREATE TABLE public.supplier_payment_exceptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.fabrica_fornecedores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cutoff_day_of_week INT NOT NULL CHECK (cutoff_day_of_week BETWEEN 0 AND 6),
  cutoff_time TIME NOT NULL DEFAULT '18:00:00',
  payment_day_of_week INT NOT NULL CHECK (payment_day_of_week BETWEEN 0 AND 6),
  allows_exceptions BOOLEAN NOT NULL DEFAULT false,
  exception_requires_approval BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_supplier_payment_exceptions_supplier ON public.supplier_payment_exceptions(supplier_id);
CREATE INDEX idx_supplier_payment_exceptions_active ON public.supplier_payment_exceptions(is_active);

-- Apenas uma exceção ativa por fornecedor
CREATE UNIQUE INDEX idx_supplier_payment_exceptions_unique_active 
  ON public.supplier_payment_exceptions(supplier_id) 
  WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.supplier_payment_exceptions ENABLE ROW LEVEL SECURITY;

-- Políticas usando can_access_payment_queue existente
CREATE POLICY "Financial team can view supplier exceptions"
  ON public.supplier_payment_exceptions
  FOR SELECT
  TO authenticated
  USING (public.can_access_payment_queue(auth.uid()));

CREATE POLICY "Financial team can insert supplier exceptions"
  ON public.supplier_payment_exceptions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_payment_queue(auth.uid()));

CREATE POLICY "Financial team can update supplier exceptions"
  ON public.supplier_payment_exceptions
  FOR UPDATE
  TO authenticated
  USING (public.can_access_payment_queue(auth.uid()));

CREATE POLICY "Financial team can delete supplier exceptions"
  ON public.supplier_payment_exceptions
  FOR DELETE
  TO authenticated
  USING (public.can_access_payment_queue(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_supplier_payment_exceptions_updated_at
  BEFORE UPDATE ON public.supplier_payment_exceptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
