-- Atualizar a função handle_new_user para aprovar automaticamente administradores
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tipo_usuario user_type;
  v_aprovado boolean;
BEGIN
  -- Extrair o tipo de usuário dos metadados
  v_tipo_usuario := COALESCE((NEW.raw_user_meta_data->>'tipo_usuario')::user_type, 'vendedor');
  
  -- Administradores são aprovados automaticamente
  v_aprovado := (v_tipo_usuario = 'admin');
  
  INSERT INTO public.profiles (id, nome, email, tipo_usuario, aprovado)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Novo Usuário'),
    NEW.email,
    v_tipo_usuario,
    v_aprovado
  );
  RETURN NEW;
END;
$function$;