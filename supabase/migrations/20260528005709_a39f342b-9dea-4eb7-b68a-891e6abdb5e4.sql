
-- 1. Acesso padrão flags
ALTER TABLE public.modulos_sistema ADD COLUMN IF NOT EXISTS acesso_padrao boolean NOT NULL DEFAULT false;
ALTER TABLE public.telas_sistema ADD COLUMN IF NOT EXISTS acesso_padrao boolean NOT NULL DEFAULT false;

-- 2. Seed pacote inicial
UPDATE public.modulos_sistema SET acesso_padrao = true WHERE codigo = 'projetos';
UPDATE public.telas_sistema SET acesso_padrao = true
WHERE codigo IN (
  'projetos_aprovacoes_central',
  'projetos_minhas_tarefas',
  'projetos_home',
  'projetos_dashboard',
  'projetos_equipe'
);

-- 3. RPC aplicar acesso padrão para um usuário (idempotente)
CREATE OR REPLACE FUNCTION public.aplicar_acesso_padrao(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.usuario_permissoes_modulos (usuario_id, modulo_id)
  SELECT _user_id, m.id
  FROM public.modulos_sistema m
  WHERE m.acesso_padrao = true AND m.ativo = true
  ON CONFLICT (usuario_id, modulo_id) DO NOTHING;

  INSERT INTO public.usuario_permissoes_telas (usuario_id, tela_id)
  SELECT _user_id, t.id
  FROM public.telas_sistema t
  WHERE t.acesso_padrao = true AND t.ativo = true
  ON CONFLICT (usuario_id, tela_id) DO NOTHING;
END;
$$;

-- 4. RPC aplicar em massa (apenas admin)
CREATE OR REPLACE FUNCTION public.aplicar_acesso_padrao_em_massa()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_modulos_inseridos int;
  v_telas_inseridas int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem aplicar acesso padrão em massa';
  END IF;

  WITH ins AS (
    INSERT INTO public.usuario_permissoes_modulos (usuario_id, modulo_id)
    SELECT p.id, m.id
    FROM public.profiles p
    CROSS JOIN public.modulos_sistema m
    WHERE m.acesso_padrao = true AND m.ativo = true
      AND COALESCE(p.status, 'ativo') = 'ativo'
    ON CONFLICT (usuario_id, modulo_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_modulos_inseridos FROM ins;

  WITH ins AS (
    INSERT INTO public.usuario_permissoes_telas (usuario_id, tela_id)
    SELECT p.id, t.id
    FROM public.profiles p
    CROSS JOIN public.telas_sistema t
    WHERE t.acesso_padrao = true AND t.ativo = true
      AND COALESCE(p.status, 'ativo') = 'ativo'
    ON CONFLICT (usuario_id, tela_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_telas_inseridas FROM ins;

  RETURN jsonb_build_object(
    'modulos_concedidos', v_modulos_inseridos,
    'telas_concedidas', v_telas_inseridas
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.aplicar_acesso_padrao(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.aplicar_acesso_padrao_em_massa() TO authenticated;

-- 5. Estender handle_new_user para aplicar acesso padrão automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, aprovado)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Novo Usuário'),
    NEW.email,
    false
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'tipo_usuario', 'vendedor')::public.app_role
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Aplicar pacote de acesso padrão a todo novo usuário
  BEGIN
    PERFORM public.aplicar_acesso_padrao(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'aplicar_acesso_padrao on signup failed for %: % %', NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

-- 6. Trigger retroativo: ao marcar uma tela/módulo como padrão, conceder a todos os usuários ativos
CREATE OR REPLACE FUNCTION public.propagar_acesso_padrao_tela()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.acesso_padrao = true AND (OLD.acesso_padrao IS DISTINCT FROM true) THEN
    INSERT INTO public.usuario_permissoes_telas (usuario_id, tela_id)
    SELECT p.id, NEW.id
    FROM public.profiles p
    WHERE COALESCE(p.status, 'ativo') = 'ativo'
    ON CONFLICT (usuario_id, tela_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.propagar_acesso_padrao_modulo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.acesso_padrao = true AND (OLD.acesso_padrao IS DISTINCT FROM true) THEN
    INSERT INTO public.usuario_permissoes_modulos (usuario_id, modulo_id)
    SELECT p.id, NEW.id
    FROM public.profiles p
    WHERE COALESCE(p.status, 'ativo') = 'ativo'
    ON CONFLICT (usuario_id, modulo_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagar_acesso_padrao_tela ON public.telas_sistema;
CREATE TRIGGER trg_propagar_acesso_padrao_tela
AFTER UPDATE OF acesso_padrao ON public.telas_sistema
FOR EACH ROW EXECUTE FUNCTION public.propagar_acesso_padrao_tela();

DROP TRIGGER IF EXISTS trg_propagar_acesso_padrao_modulo ON public.modulos_sistema;
CREATE TRIGGER trg_propagar_acesso_padrao_modulo
AFTER UPDATE OF acesso_padrao ON public.modulos_sistema
FOR EACH ROW EXECUTE FUNCTION public.propagar_acesso_padrao_modulo();

-- 7. Aplicar imediatamente o pacote padrão a todos os usuários ativos que ainda não têm
DO $$
DECLARE v_uid uuid;
BEGIN
  FOR v_uid IN SELECT id FROM public.profiles WHERE COALESCE(status,'ativo')='ativo'
  LOOP
    PERFORM public.aplicar_acesso_padrao(v_uid);
  END LOOP;
END $$;
