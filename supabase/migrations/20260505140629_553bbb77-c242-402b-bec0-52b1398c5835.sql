UPDATE auth.users
SET encrypted_password = crypt('Ruby@2026#R', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE id IN (
  '993c0efd-b45b-4c3d-b04d-b87fac215b5c',
  'bdb97add-babf-4fc5-86ef-bdb885853635',
  '28484b57-003b-4710-97e4-047e8e22d358'
);