-- Adicionar campos de aprovação à tabela trade_budgets
ALTER TABLE trade_budgets
ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS requested_by uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS approved_at timestamptz,
ADD COLUMN IF NOT EXISTS rejection_reason text,
ADD COLUMN IF NOT EXISTS notes text;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_trade_budgets_approval_status ON trade_budgets(approval_status);
CREATE INDEX IF NOT EXISTS idx_trade_budgets_requested_by ON trade_budgets(requested_by);

-- Atualizar RLS policies para permitir solicitações de orçamento
DROP POLICY IF EXISTS "Usuários podem visualizar orçamentos" ON trade_budgets;
DROP POLICY IF EXISTS "Usuários podem criar orçamentos" ON trade_budgets;
DROP POLICY IF EXISTS "Apenas admins podem atualizar orçamentos" ON trade_budgets;

-- Policy para visualização (todos podem ver seus orçamentos)
CREATE POLICY "Usuários podem visualizar orçamentos"
ON trade_budgets FOR SELECT
TO authenticated
USING (
  requested_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor')
  )
);

-- Policy para criação (todos autenticados podem solicitar)
CREATE POLICY "Usuários podem solicitar orçamentos"
ON trade_budgets FOR INSERT
TO authenticated
WITH CHECK (requested_by = auth.uid());

-- Policy para atualização (apenas admins podem aprovar/rejeitar)
CREATE POLICY "Admins podem aprovar orçamentos"
ON trade_budgets FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Trigger para notificar quando orçamento for aprovado/rejeitado
CREATE OR REPLACE FUNCTION notify_budget_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.approval_status = 'pending' AND NEW.approval_status IN ('approved', 'rejected') THEN
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      NEW.requested_by,
      CASE WHEN NEW.approval_status = 'approved' THEN 'budget_approved' ELSE 'budget_rejected' END,
      CASE WHEN NEW.approval_status = 'approved' THEN 'Orçamento Aprovado' ELSE 'Orçamento Rejeitado' END,
      CASE 
        WHEN NEW.approval_status = 'approved' THEN 
          'Seu orçamento "' || NEW.name || '" foi aprovado!'
        ELSE 
          'Seu orçamento "' || NEW.name || '" foi rejeitado. Motivo: ' || COALESCE(NEW.rejection_reason, 'Não especificado')
      END,
      '/dashboard/contas-a-pagar'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_budget_approval ON trade_budgets;
CREATE TRIGGER trigger_notify_budget_approval
AFTER UPDATE ON trade_budgets
FOR EACH ROW
EXECUTE FUNCTION notify_budget_approval();