
DO $$
DECLARE
  v_user_id uuid;
  v_dept_china uuid := '79392f6b-4ab5-400b-88b5-7f0020ec4b77';
  v_modulo_china uuid := '9edc8260-b080-4432-b055-8747b24c4520';
BEGIN
  -- 1) Auth user
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'chinarubyrose@gmail.com';

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id, 'authenticated', 'authenticated',
      'chinarubyrose@gmail.com',
      crypt('RubyRose@China2026', gen_salt('bf')),
      now(),
      jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
      jsonb_build_object('nome_completo','Ruby Rose China'),
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_user_id, v_user_id::text,
      jsonb_build_object('sub', v_user_id::text, 'email', 'chinarubyrose@gmail.com', 'email_verified', true),
      'email', now(), now(), now()
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = crypt('RubyRose@China2026', gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = v_user_id;
  END IF;

  -- 2) Profile
  INSERT INTO public.profiles (id, nome, email, status, aprovado, departamento_id, preferred_language)
  VALUES (v_user_id, 'Ruby Rose China', 'chinarubyrose@gmail.com', 'ativo', true, v_dept_china, 'pt')
  ON CONFLICT (id) DO UPDATE
    SET nome = EXCLUDED.nome,
        departamento_id = EXCLUDED.departamento_id,
        status = 'ativo',
        aprovado = true,
        updated_at = now();

  -- 3) Role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'consultor')
  ON CONFLICT DO NOTHING;

  -- 4) Limpar permissões anteriores para garantir escopo mínimo
  DELETE FROM public.usuario_permissoes_modulos WHERE usuario_id = v_user_id;
  DELETE FROM public.usuario_permissoes_telas WHERE usuario_id = v_user_id;

  -- 5) Permissão de módulo (apenas China)
  INSERT INTO public.usuario_permissoes_modulos (usuario_id, modulo_id)
  VALUES (v_user_id, v_modulo_china);

  -- 6) Permissões de tela (Painel/Caixa Entrada, Submissões/Nova, Ordens Compra/Produção)
  INSERT INTO public.usuario_permissoes_telas (usuario_id, tela_id)
  SELECT v_user_id, id FROM public.telas_sistema
   WHERE codigo IN ('china_dashboard','china_submissoes','china_ordens');
END $$;
