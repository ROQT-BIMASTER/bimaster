-- Adicionar campo de aprovação na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS aprovado BOOLEAN NOT NULL DEFAULT false;

-- Atualizar a função handle_new_user para criar usuários não aprovados
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, nome, email, tipo_usuario, aprovado)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Novo Usuário'),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'tipo_usuario')::user_type, 'vendedor'),
    false  -- Novos usuários começam não aprovados
  );
  RETURN NEW;
END;
$function$;

-- Criar índice para buscas por status de aprovação
CREATE INDEX IF NOT EXISTS idx_profiles_aprovado ON public.profiles(aprovado);