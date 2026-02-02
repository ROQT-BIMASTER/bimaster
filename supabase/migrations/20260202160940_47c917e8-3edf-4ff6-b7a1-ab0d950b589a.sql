-- Fix function search path for security
CREATE OR REPLACE FUNCTION update_fabrica_ficha_custo_config_updated_at()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;