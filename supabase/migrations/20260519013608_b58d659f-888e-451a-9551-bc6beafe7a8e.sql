
-- Criar usuário Isa Cargon e aprovar Francelina Menezes, aplicando permissões do módulo Projetos

DO $$
DECLARE
  v_isa_id uuid;
  v_fran_id uuid := '49b1604a-2813-4e5b-9ea9-c03e030c2f28';
  v_pwd text := 'RubyRose@2026';
  v_modulo_id uuid := 'a6aa92be-30a6-4027-aa0d-225b96cc96fe';
  v_telas uuid[] := ARRAY[
    '7c3ca445-6629-4b7d-bbf3-19e45a610d12'::uuid, -- Central de Aprovações
    '9379977d-d783-43c5-8431-c6fb973d337f'::uuid, -- Central de Trabalho
    'eadcbfaa-dd1e-44e5-a95b-b86d9a8d5e7f'::uuid  -- Minha Equipe
  ];
  v_tela uuid;
BEGIN
  -- ===== ISA CARGON =====
  SELECT id INTO v_isa_id FROM auth.users WHERE email = 'i.cargon@distribuidoraunion.com.br';

  IF v_isa_id IS NULL THEN
    v_isa_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_isa_id, 'authenticated', 'authenticated',
      'i.cargon@distribuidoraunion.com.br',
      crypt(v_pwd, gen_salt('bf')),
      now(),
      jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
      jsonb_build_object('nome','Isa Cargon'),
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_isa_id,
      jsonb_build_object('sub', v_isa_id::text, 'email','i.cargon@distribuidoraunion.com.br', 'email_verified', true),
      'email', v_isa_id::text, now(), now(), now()
    );
  END IF;

  -- Garantir profile aprovado/ativo
  INSERT INTO public.profiles (id, nome, email, status, aprovado)
  VALUES (v_isa_id, 'Isa Cargon', 'i.cargon@distribuidoraunion.com.br', 'ativo', true)
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    status = 'ativo',
    aprovado = true,
    updated_at = now();

  -- ===== FRANCELINA: aprovar e resetar senha =====
  UPDATE auth.users
     SET encrypted_password = crypt(v_pwd, gen_salt('bf')),
         email_confirmed_at = COALESCE(email_confirmed_at, now()),
         updated_at = now()
   WHERE id = v_fran_id;

  UPDATE public.profiles
     SET status = 'ativo', aprovado = true, updated_at = now()
   WHERE id = v_fran_id;

  -- ===== Permissões para ambas =====
  FOREACH v_tela IN ARRAY ARRAY[v_isa_id, v_fran_id] LOOP
    -- role vendedor (padrão não-admin)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_tela, 'vendedor')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- módulo Projetos
    INSERT INTO public.usuario_permissoes_modulos (usuario_id, modulo_id)
    VALUES (v_tela, v_modulo_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- telas
  FOREACH v_tela IN ARRAY v_telas LOOP
    INSERT INTO public.usuario_permissoes_telas (usuario_id, tela_id)
    VALUES (v_isa_id, v_tela) ON CONFLICT DO NOTHING;
    INSERT INTO public.usuario_permissoes_telas (usuario_id, tela_id)
    VALUES (v_fran_id, v_tela) ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
