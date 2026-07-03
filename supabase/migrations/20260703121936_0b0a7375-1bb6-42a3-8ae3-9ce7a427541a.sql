
-- Função: aprova usuário e concede módulo Projetos quando o domínio for @distribuidoraunion.com.br e o e-mail estiver verificado
CREATE OR REPLACE FUNCTION public.auto_approve_distribuidora_union()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projetos_id uuid;
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(split_part(NEW.email, '@', 2)) = 'distribuidoraunion.com.br' THEN

    -- Aprova o perfil (perfil é criado por outro trigger de signup existente)
    UPDATE public.profiles
       SET aprovado = true,
           status = 'ativo',
           updated_at = now()
     WHERE id = NEW.id;

    -- Concede acesso ao módulo Projetos
    SELECT id INTO v_projetos_id FROM public.modulos_sistema WHERE codigo = 'projetos' LIMIT 1;
    IF v_projetos_id IS NOT NULL THEN
      INSERT INTO public.usuario_permissoes_modulos (usuario_id, modulo_id)
      VALUES (NEW.id, v_projetos_id)
      ON CONFLICT (usuario_id, modulo_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_union_domain ON auth.users;
CREATE TRIGGER on_auth_user_created_union_domain
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.auto_approve_distribuidora_union();

DROP TRIGGER IF EXISTS on_auth_user_confirmed_union_domain ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_union_domain
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (old.email_confirmed_at IS NULL AND new.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.auto_approve_distribuidora_union();

-- Backfill: aplica a usuários existentes do domínio
DO $$
DECLARE
  v_projetos_id uuid;
BEGIN
  SELECT id INTO v_projetos_id FROM public.modulos_sistema WHERE codigo = 'projetos' LIMIT 1;

  UPDATE public.profiles p
     SET aprovado = true,
         status = 'ativo',
         updated_at = now()
    FROM auth.users u
   WHERE p.id = u.id
     AND u.email_confirmed_at IS NOT NULL
     AND lower(split_part(u.email, '@', 2)) = 'distribuidoraunion.com.br'
     AND (p.aprovado = false OR p.status <> 'ativo');

  IF v_projetos_id IS NOT NULL THEN
    INSERT INTO public.usuario_permissoes_modulos (usuario_id, modulo_id)
    SELECT p.id, v_projetos_id
      FROM public.profiles p
      JOIN auth.users u ON u.id = p.id
     WHERE u.email_confirmed_at IS NOT NULL
       AND lower(split_part(u.email, '@', 2)) = 'distribuidoraunion.com.br'
    ON CONFLICT (usuario_id, modulo_id) DO NOTHING;
  END IF;
END $$;
