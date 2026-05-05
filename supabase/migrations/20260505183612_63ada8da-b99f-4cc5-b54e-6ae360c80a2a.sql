
DO $$
DECLARE
  v_felipe uuid := 'e811d98e-eb9b-4414-94da-5f34b630e63f';
  v_modulo uuid := 'a6aa92be-30a6-4027-aa0d-225b96cc96fe';
  v_user_id uuid;
  v_email text;
  v_nome text;
  rec record;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('guilherme.balielo@roqt.com.br', 'Guilherme Balielo'),
      ('junia.nunes@roqt.com.br', 'Junia Nunes')
    ) AS t(email, nome)
  LOOP
    v_email := rec.email;
    v_nome := rec.nome;

    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

    IF v_user_id IS NULL THEN
      v_user_id := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token,
        email_change, email_change_token_new, recovery_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated', v_email,
        crypt('Roqt@2026', gen_salt('bf')), now(),
        jsonb_build_object('provider','email','providers',array['email']),
        jsonb_build_object('nome', v_nome, 'tipo_usuario','vendedor'),
        now(), now(), '', '', '', ''
      );
      INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
      VALUES (gen_random_uuid(), v_user_id,
              jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
              'email', v_user_id::text, now(), now(), now());
    END IF;

    INSERT INTO public.profiles (id, email, nome, supervisor_id, aprovado, status)
    VALUES (v_user_id, v_email, v_nome, v_felipe, true, 'ativo')
    ON CONFLICT (id) DO UPDATE SET
      nome = EXCLUDED.nome,
      email = EXCLUDED.email,
      supervisor_id = EXCLUDED.supervisor_id,
      aprovado = true,
      status = 'ativo';

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'vendedor')
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.usuario_permissoes_modulos (usuario_id, modulo_id)
    VALUES (v_user_id, v_modulo)
    ON CONFLICT (usuario_id, modulo_id) DO NOTHING;

    INSERT INTO public.usuario_permissoes_telas (usuario_id, tela_id)
    SELECT v_user_id, ts.id
    FROM public.telas_sistema ts
    WHERE ts.codigo IN ('projetos_aprovacoes_central','projetos_home','projetos_dashboard','projetos_equipe')
    ON CONFLICT (usuario_id, tela_id) DO NOTHING;
  END LOOP;

  -- Felipe: coordenador (supervisor)
  DELETE FROM public.user_roles WHERE user_id = v_felipe AND role <> 'supervisor';
  INSERT INTO public.user_roles (user_id, role) VALUES (v_felipe, 'supervisor')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.usuario_permissoes_modulos (usuario_id, modulo_id)
  VALUES (v_felipe, v_modulo)
  ON CONFLICT (usuario_id, modulo_id) DO NOTHING;

  INSERT INTO public.usuario_permissoes_telas (usuario_id, tela_id)
  SELECT v_felipe, ts.id
  FROM public.telas_sistema ts
  WHERE ts.codigo IN ('projetos_aprovacoes_central','projetos_home','projetos_dashboard','projetos_equipe')
  ON CONFLICT (usuario_id, tela_id) DO NOTHING;
END $$;
