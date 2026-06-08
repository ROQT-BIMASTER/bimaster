ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS rg text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_cpf_unique
  ON public.profiles (cpf)
  WHERE cpf IS NOT NULL AND cpf <> '';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, nome, email, aprovado, cargo, telefone, cpf, rg)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Novo Usuário'),
    NEW.email,
    false,
    NULLIF(NEW.raw_user_meta_data->>'cargo', ''),
    NULLIF(NEW.raw_user_meta_data->>'telefone', ''),
    NULLIF(NEW.raw_user_meta_data->>'cpf', ''),
    NULLIF(NEW.raw_user_meta_data->>'rg', '')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'tipo_usuario', 'vendedor')::public.app_role
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  BEGIN
    PERFORM public.aplicar_acesso_padrao(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'aplicar_acesso_padrao on signup failed for %: % %', NEW.id, SQLERRM, SQLSTATE;
  END;

  BEGIN
    PERFORM public.rpc_garantir_usuario_em_comunicados(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'rpc_garantir_usuario_em_comunicados on signup failed for %: % %', NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$function$;