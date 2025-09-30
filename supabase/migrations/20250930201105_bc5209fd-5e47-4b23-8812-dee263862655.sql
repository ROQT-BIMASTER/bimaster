-- Corrigir função update_assinatura_timestamp com search_path seguro
CREATE OR REPLACE FUNCTION update_assinatura_timestamp()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;