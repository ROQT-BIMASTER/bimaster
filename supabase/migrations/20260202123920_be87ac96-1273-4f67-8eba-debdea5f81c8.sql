-- Fix: Corrigir o trigger que usa coluna 'link' inexistente (correto é 'action_url')
CREATE OR REPLACE FUNCTION public.notify_budget_approval_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.approval_status = 'pending' AND NEW.approval_status IN ('approved', 'rejected') THEN
    INSERT INTO notifications (user_id, type, title, message, action_url)
    VALUES (
      NEW.requested_by,
      CASE WHEN NEW.approval_status = 'approved' THEN 'success' ELSE 'warning' END,
      CASE WHEN NEW.approval_status = 'approved' 
        THEN 'Orçamento Aprovado' 
        ELSE 'Orçamento Rejeitado' 
      END,
      CASE WHEN NEW.approval_status = 'approved' 
        THEN 'Seu orçamento "' || NEW.name || '" foi aprovado!' 
        ELSE 'Seu orçamento "' || NEW.name || '" foi rejeitado. Motivo: ' || COALESCE(NEW.rejection_reason, 'Não informado')
      END,
      '/dashboard/trade/admin/verbas'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;