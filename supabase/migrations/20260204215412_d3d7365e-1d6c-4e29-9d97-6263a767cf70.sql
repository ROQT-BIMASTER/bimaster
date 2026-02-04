-- ===========================================
-- Central de Pagamentos do Financeiro
-- ===========================================

-- 1. Criar tabela principal de fila de pagamentos
CREATE TABLE public.financial_payment_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code varchar(50) NOT NULL,
  source_type varchar(50) NOT NULL CHECK (source_type IN ('trade_entry', 'trade_investment', 'trade_campaign', 'event_expense')),
  source_id uuid NOT NULL,
  source_code varchar(100),
  supplier_name varchar(255) NOT NULL,
  supplier_document varchar(20),
  document_type varchar(50),
  document_number varchar(100),
  amount numeric(15,2) NOT NULL,
  due_date date NOT NULL,
  portador varchar(100),
  description text,
  notes text,
  attachment_url text,
  department_name varchar(100),
  requested_by uuid REFERENCES auth.users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  financial_status varchar(20) NOT NULL DEFAULT 'pending' CHECK (financial_status IN ('pending', 'accepted', 'rejected', 'paid', 'cancelled')),
  financial_notes text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  paid_at timestamptz,
  contas_pagar_id uuid REFERENCES public.contas_pagar(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_fpq_status ON public.financial_payment_queue(financial_status);
CREATE INDEX idx_fpq_source ON public.financial_payment_queue(source_type, source_id);
CREATE INDEX idx_fpq_due_date ON public.financial_payment_queue(due_date);
CREATE INDEX idx_fpq_requested_by ON public.financial_payment_queue(requested_by);

-- Sequência para código legível
CREATE SEQUENCE IF NOT EXISTS fpq_code_seq START 1;

-- Trigger para gerar código automático
CREATE OR REPLACE FUNCTION generate_fpq_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'FPQ-' || EXTRACT(YEAR FROM NOW()) || '-' || LPAD(nextval('fpq_code_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fpq_code
BEFORE INSERT ON public.financial_payment_queue
FOR EACH ROW
EXECUTE FUNCTION generate_fpq_code();

-- Trigger para updated_at
CREATE TRIGGER update_fpq_updated_at
BEFORE UPDATE ON public.financial_payment_queue
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Adicionar colunas em trade_financial_entries
ALTER TABLE public.trade_financial_entries
ADD COLUMN IF NOT EXISTS send_to_financial boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS supplier_name varchar(255),
ADD COLUMN IF NOT EXISTS supplier_document varchar(20),
ADD COLUMN IF NOT EXISTS document_type varchar(50),
ADD COLUMN IF NOT EXISTS document_number varchar(100),
ADD COLUMN IF NOT EXISTS due_date date,
ADD COLUMN IF NOT EXISTS portador varchar(100),
ADD COLUMN IF NOT EXISTS payment_queue_id uuid REFERENCES public.financial_payment_queue(id);

-- 3. Adicionar colunas em trade_investments
ALTER TABLE public.trade_investments
ADD COLUMN IF NOT EXISTS send_to_financial boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS supplier_name varchar(255),
ADD COLUMN IF NOT EXISTS supplier_document varchar(20),
ADD COLUMN IF NOT EXISTS document_type varchar(50),
ADD COLUMN IF NOT EXISTS document_number varchar(100),
ADD COLUMN IF NOT EXISTS due_date date,
ADD COLUMN IF NOT EXISTS portador varchar(100),
ADD COLUMN IF NOT EXISTS payment_queue_id uuid REFERENCES public.financial_payment_queue(id);

-- 4. Função para verificar acesso à fila de pagamentos
CREATE OR REPLACE FUNCTION public.can_access_payment_queue(_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles p
    LEFT JOIN departamentos d ON p.departamento_id = d.id
    WHERE p.id = _user_id 
    AND (
      d.nome ILIKE '%Financeiro%' 
      OR d.nome ILIKE '%Tesouraria%' 
      OR d.nome ILIKE '%Controladoria%'
      OR p.role = 'admin'
    )
  )
  OR public.has_role(_user_id, 'admin');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 5. Enable RLS
ALTER TABLE public.financial_payment_queue ENABLE ROW LEVEL SECURITY;

-- 6. Políticas RLS

-- Leitura: Financeiro/Admin podem ver tudo, outros podem ver o que solicitaram
CREATE POLICY "fpq_select_policy" ON public.financial_payment_queue
FOR SELECT USING (
  public.can_access_payment_queue(auth.uid())
  OR requested_by = auth.uid()
);

-- Inserção: Usuários autenticados podem criar
CREATE POLICY "fpq_insert_policy" ON public.financial_payment_queue
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Atualização: Apenas Financeiro/Admin podem atualizar status
CREATE POLICY "fpq_update_policy" ON public.financial_payment_queue
FOR UPDATE USING (
  public.can_access_payment_queue(auth.uid())
);

-- Delete: Apenas admin
CREATE POLICY "fpq_delete_policy" ON public.financial_payment_queue
FOR DELETE USING (public.has_role(auth.uid(), 'admin'));