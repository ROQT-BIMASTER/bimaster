CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_tipo_usuario text;
  v_role public.app_role;
  v_aprovado boolean;
BEGIN
  v_tipo_usuario := COALESCE(NEW.raw_user_meta_data->>'tipo_usuario', 'vendedor');
  
  v_role := CASE v_tipo_usuario
    WHEN 'admin' THEN 'admin'::public.app_role
    WHEN 'gerente' THEN 'gerente'::public.app_role
    WHEN 'supervisor' THEN 'supervisor'::public.app_role
    WHEN 'promotor' THEN 'promotor'::public.app_role
    ELSE 'vendedor'::public.app_role
  END;
  
  v_aprovado := (v_role = 'admin'::public.app_role);
  
  INSERT INTO public.profiles (id, nome, email, aprovado)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Novo Usuário'),
    NEW.email,
    v_aprovado
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;