
-- Drop existing trigger with correct name
DROP TRIGGER IF EXISTS trigger_calcular_status_conta ON public.contas_receber;

-- Drop and recreate the function
DROP FUNCTION IF EXISTS public.calcular_status_conta_receber() CASCADE;

-- Create improved function to calculate status
CREATE OR REPLACE FUNCTION public.calcular_status_conta_receber()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Calculate days overdue
  IF NEW.data_vencimento IS NOT NULL THEN
    NEW.dias_atraso := GREATEST(0, CURRENT_DATE - NEW.data_vencimento);
  ELSE
    NEW.dias_atraso := 0;
  END IF;
  
  -- Determine status based on values and dates
  IF COALESCE(NEW.valor_aberto, 0) = 0 THEN
    -- Fully paid
    NEW.status := 'recebido';
  ELSIF COALESCE(NEW.valor_recebido, 0) > 0 AND COALESCE(NEW.valor_aberto, 0) > 0 THEN
    -- Partially paid
    NEW.status := 'parcial';
  ELSIF NEW.data_vencimento < CURRENT_DATE AND COALESCE(NEW.valor_aberto, 0) > 0 THEN
    -- Overdue
    NEW.status := 'vencido';
  ELSE
    -- Pending (not yet due)
    NEW.status := 'pendente';
  END IF;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

-- Create trigger for INSERT and UPDATE
CREATE TRIGGER trigger_calcular_status_conta
BEFORE INSERT OR UPDATE ON public.contas_receber
FOR EACH ROW
EXECUTE FUNCTION public.calcular_status_conta_receber();

-- Update all existing records to recalculate status
UPDATE public.contas_receber
SET updated_at = now()
WHERE id IS NOT NULL;
