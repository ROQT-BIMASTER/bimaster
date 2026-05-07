
DO $$
BEGIN
  UPDATE auth.users
  SET encrypted_password = crypt('Bimaster@2026', gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
  WHERE id IN ('f0fe00f9-da33-458c-be16-e470e96fbc1b','8f631f75-7c3b-4926-ae27-2201e5a8c9b9');
END $$;
