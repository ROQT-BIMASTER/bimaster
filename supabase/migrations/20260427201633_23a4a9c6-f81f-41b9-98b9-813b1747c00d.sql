
-- Cria 2 novos usuários (Ronaldo e Francelina) com senha padrão
DO $$
DECLARE
  v_ronaldo uuid := gen_random_uuid();
  v_francelina uuid := gen_random_uuid();
  v_nathalia uuid := 'f8b9a84e-67d2-449a-bc5a-3d15a9dfd379';
  v_victoria uuid := 'd86d7ed2-3239-4dbe-8fc3-c788e7f2d923';
  v_dept_marketing uuid := '8cce900f-2455-4ed3-9b3a-54a993de037f';
  v_modulo_projetos uuid := 'a6aa92be-30a6-4027-aa0d-225b96cc96fe';
BEGIN
  -- Inserir Ronaldo se não existir
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email='r.simoes@rubyrose.com.br') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_ronaldo, 'authenticated', 'authenticated',
      'r.simoes@rubyrose.com.br', crypt('RubyRose@2026', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nome":"Ronaldo Simões"}'::jsonb,
      '', '', '', ''
    );
  ELSE
    SELECT id INTO v_ronaldo FROM auth.users WHERE email='r.simoes@rubyrose.com.br';
  END IF;

  -- Inserir Francelina se não existir
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email='f.menezes@rubyrose.com.br') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_francelina, 'authenticated', 'authenticated',
      'f.menezes@rubyrose.com.br', crypt('RubyRose@2026', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nome":"Francelina Menezes"}'::jsonb,
      '', '', '', ''
    );
  ELSE
    SELECT id INTO v_francelina FROM auth.users WHERE email='f.menezes@rubyrose.com.br';
  END IF;

  -- Garantir profiles (handle_new_user trigger pode ter criado, mas garantimos)
  INSERT INTO profiles (id, email, nome, aprovado, departamento_id)
  VALUES (v_ronaldo, 'r.simoes@rubyrose.com.br', 'Ronaldo Simões', true, v_dept_marketing)
  ON CONFLICT (id) DO UPDATE SET nome=EXCLUDED.nome, aprovado=true, departamento_id=v_dept_marketing;

  INSERT INTO profiles (id, email, nome, aprovado, departamento_id)
  VALUES (v_francelina, 'f.menezes@rubyrose.com.br', 'Francelina Menezes', true, v_dept_marketing)
  ON CONFLICT (id) DO UPDATE SET nome=EXCLUDED.nome, aprovado=true, departamento_id=v_dept_marketing;

  -- Configurar Nathalia como gerente do departamento Marketing (sem supervisor)
  UPDATE profiles
     SET departamento_id = v_dept_marketing,
         supervisor_id = NULL,
         aprovado = true
   WHERE id = v_nathalia;

  -- Victoria, Ronaldo, Francelina => subordinados de Nathalia
  UPDATE profiles
     SET departamento_id = v_dept_marketing,
         supervisor_id = v_nathalia,
         aprovado = true
   WHERE id IN (v_victoria, v_ronaldo, v_francelina);

  -- Roles: Nathalia => gerente, demais => vendedor (default operacional)
  INSERT INTO user_roles (user_id, role) VALUES (v_nathalia, 'gerente')
    ON CONFLICT (user_id, role) DO NOTHING;
  -- Remove role vendedor antiga da Nathalia
  DELETE FROM user_roles WHERE user_id = v_nathalia AND role = 'vendedor';

  INSERT INTO user_roles (user_id, role) VALUES
    (v_victoria, 'vendedor'),
    (v_ronaldo, 'vendedor'),
    (v_francelina, 'vendedor')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Liberar módulo Projetos para os 4
  INSERT INTO usuario_permissoes_modulos (usuario_id, modulo_id)
  SELECT uid, v_modulo_projetos FROM unnest(ARRAY[v_nathalia, v_victoria, v_ronaldo, v_francelina]) AS uid
  ON CONFLICT DO NOTHING;

  -- Liberar as 4 telas de Projetos
  INSERT INTO usuario_permissoes_telas (usuario_id, tela_id)
  SELECT uid, t.id
  FROM unnest(ARRAY[v_nathalia, v_victoria, v_ronaldo, v_francelina]) AS uid
  CROSS JOIN telas_sistema t
  WHERE t.codigo IN ('projetos_inbox','projetos_aprovacoes','projetos_home','projetos_dashboard')
  ON CONFLICT DO NOTHING;
END $$;
