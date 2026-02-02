-- Adicionar campos de inativação na tabela trade_budgets
ALTER TABLE public.trade_budgets
ADD COLUMN IF NOT EXISTS inactivated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS inactivated_by UUID,
ADD COLUMN IF NOT EXISTS inactivated_reason TEXT;

-- Criar tabela de auditoria para verbas
CREATE TABLE IF NOT EXISTS public.trade_budget_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID REFERENCES public.trade_budgets(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  user_id UUID,
  user_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.trade_budget_audit_log ENABLE ROW LEVEL SECURITY;

-- Política para leitura - todos usuários autenticados podem ver o histórico
CREATE POLICY "Authenticated users can view budget audit log"
ON public.trade_budget_audit_log
FOR SELECT
TO authenticated
USING (true);

-- Política para inserção - todos usuários autenticados podem inserir
CREATE POLICY "Authenticated users can insert budget audit log"
ON public.trade_budget_audit_log
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_trade_budget_audit_log_budget_id ON public.trade_budget_audit_log(budget_id);
CREATE INDEX IF NOT EXISTS idx_trade_budget_audit_log_created_at ON public.trade_budget_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_budgets_inactivated_at ON public.trade_budgets(inactivated_at);