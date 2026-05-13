
DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_email text := 'karymy.goncalves@agenciakilo.com.br';
  v_password text := 'Bimaster@2026';
  v_supervisor uuid := 'f0fe00f9-da33-458c-be16-e470e96fbc1b'; -- guilherme.vieira
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
    v_email, crypt(v_password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
    jsonb_build_object('nome','Karymy Gonçalves','tipo_usuario','consultor'),
    now(), now(), '', '', '', ''
  );

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_user_id, v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now());

  -- garantir profile
  INSERT INTO public.profiles (id, email, nome, supervisor_id, aprovado, status)
  VALUES (v_user_id, v_email, 'Karymy Gonçalves', v_supervisor, true, 'ativo')
  ON CONFLICT (id) DO UPDATE
    SET nome = EXCLUDED.nome,
        email = EXCLUDED.email,
        supervisor_id = EXCLUDED.supervisor_id,
        aprovado = true,
        status = 'ativo';

  -- role consultor (mesmo que Guilherme)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'consultor')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- replicar módulos do Guilherme
  INSERT INTO public.usuario_permissoes_modulos (usuario_id, modulo_id)
  SELECT v_user_id, modulo_id
  FROM public.usuario_permissoes_modulos
  WHERE usuario_id = v_supervisor
  ON CONFLICT DO NOTHING;

  -- replicar projetos do Guilherme (como membro)
  INSERT INTO public.projeto_membros (projeto_id, user_id, papel)
  SELECT projeto_id, v_user_id, 'membro'
  FROM public.projeto_membros
  WHERE user_id = v_supervisor
  ON CONFLICT DO NOTHING;
END $$;
