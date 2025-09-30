-- Corrigir função para ter search_path definido
CREATE OR REPLACE FUNCTION public.update_conversa_timestamp()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversas
  SET updated_at = now()
  WHERE id = NEW.conversa_id;
  RETURN NEW;
END;
$$;