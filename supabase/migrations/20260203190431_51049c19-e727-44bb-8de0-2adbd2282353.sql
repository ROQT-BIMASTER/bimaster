-- Corrigir função de notificação para usar action_url ao invés de link
CREATE OR REPLACE FUNCTION public.notify_budget_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.approval_status = 'pending' AND NEW.approval_status IN ('approved', 'rejected') THEN
    INSERT INTO notifications (user_id, type, title, message, action_url)
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
      '/dashboard/trade/financeiro/verbas'
    );
  END IF;
  RETURN NEW;
END;
$function$;