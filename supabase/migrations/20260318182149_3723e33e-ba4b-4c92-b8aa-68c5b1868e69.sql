
-- Fix trigger_atualizar_perfil_credito: add public. prefix to function calls
-- The function has SET search_path TO '' but calls functions without schema prefix
CREATE OR REPLACE FUNCTION public.trigger_atualizar_perfil_credito()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM public.atualizar_perfil_credito_cliente(NEW.cliente_codigo);
  RETURN NEW;
END;
$$;
