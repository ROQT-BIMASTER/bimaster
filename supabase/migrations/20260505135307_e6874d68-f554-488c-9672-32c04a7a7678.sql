UPDATE auth.users
SET encrypted_password = crypt('Ruby2026', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email = 'r.silva@rubyrose.com.br';